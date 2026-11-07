/**
 * CutList Optimizer v1.126 — Native Android Bridge & Multi-Strategy 2D Guillotine Solver
 * Emulates the exact `window.android` JavascriptInterface from com.cutlistoptimizer (classes.dex)
 * and runs 100% locally in the browser / WebView with zero external server dependency.
 */
(function () {
    // Non-blocking toast helper for sandboxed environments
    function showInPageNotice(msg, isError) {
        try {
            var container = document.querySelector('.toast-top-right');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-top-right';
                container.style.cssText = 'position:fixed;top:58px;right:12px;z-index:999999;';
                document.body.appendChild(container);
            }
            var toast = document.createElement('div');
            toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-info');
            toast.style.cssText = 'margin-bottom:6px;padding:12px 16px;border-radius:4px;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-size:13px;min-width:240px;background-color:' + (isError ? '#c62828' : '#2e7d32') + ';';
            toast.textContent = msg;
            container.appendChild(toast);
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 3200);
        } catch (e) {
            console.log("Notice:", msg);
        }
    }

    // Override window.alert and window.confirm so they never fail inside sandboxed iframes
    var origConfirm = window.confirm;
    window.alert = function (msg) {
        showInPageNotice(String(msg || ''), false);
    };
    window.confirm = function (msg) {
        try {
            var r = origConfirm.call(window, msg);
            if (typeof r === 'boolean') return r;
        } catch (e) {}
        return true;
    };

    var tasksStore = {};
    var EPS = 1e-4;

    function makeRng(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ------------------------------------------------------------------
    // 1) تجهيز المسألة: القطع (مجمّعة في groups) وأنواع الألواح الخام
    // ------------------------------------------------------------------
    function prepareProblem(request) {
        var cfg = request.configuration || {};
        var prob = {
            request: request,
            kerf: Math.max(0, parseFloat(cfg.cutThickness) || 0),
            minTrim: Math.max(0, parseFloat(cfg.minTrimDimension) || 0),
            considerMaterial: !!cfg.isMaterialEnabled,
            considerGrain: !!cfg.considerOrientation,
            hasEdgeBanding: !!cfg.hasEdgeBanding,
            single: !!cfg.useSingleStockUnit,
            priority: parseInt(cfg.optimizationPriority) || 0,
            cutPref: parseInt(cfg.cutOrientationPreference) || 0,
            level: parseFloat(cfg.optimizationFactor),
            groups: [],
            stocks: [],
            panelSummaryMap: {},
            pieceCount: 0,
            pieceArea: 0
        };
        if (!(prob.level > 0)) prob.level = 1;

        (request.panels || []).forEach(function (p) {
            if (!p.enabled) return;
            var w = parseFloat(p.width), h = parseFloat(p.height), count = parseInt(p.count) || 0;
            if (!(w > 0 && h > 0 && count > 0)) return;
            var edge = prob.hasEdgeBanding && p.edge ? {
                top: p.edge.top || null, bottom: p.edge.bottom || null,
                left: p.edge.left || null, right: p.edge.right || null
            } : { top: null, bottom: null, left: null, right: null };
            prob.panelSummaryMap[p.id] = {
                requestObjId: p.id, width: w, height: h, count: count,
                label: p.label || null, material: p.material || null, enabled: true
            };
            prob.groups.push({
                requestObjId: p.id, width: w, height: h, count: count,
                label: p.label || null,
                material: prob.considerMaterial ? (p.material || '') : '',
                rawMaterial: p.material || null,
                orientation: prob.considerGrain ? (parseInt(p.orientation) || 0) : 0,
                edge: edge
            });
            prob.pieceCount += count;
            prob.pieceArea += w * h * count;
        });

        (request.stockPanels || []).forEach(function (s) {
            if (!s.enabled) return;
            var w = parseFloat(s.width), h = parseFloat(s.height), count = parseInt(s.count) || 0;
            if (!(w > 0 && h > 0 && count > 0)) return;
            prob.stocks.push({
                requestObjId: s.id, width: w, height: h, count: count,
                label: s.label || null,
                material: prob.considerMaterial ? (s.material || '') : '',
                rawMaterial: s.material || null,
                orientation: prob.considerGrain ? (parseInt(s.orientation) || 0) : 0,
                area: w * h
            });
        });
        return prob;
    }

    // bit 1 = تنفع بدون لف، bit 2 = تنفع بعد لف 90°
    function fitMask(prob, g, rw, rh, stockOri) {
        var normalOk = (g.width <= rw + 1e-6 && g.height <= rh + 1e-6);
        var rotOk = (g.height <= rw + 1e-6 && g.width <= rh + 1e-6);
        if (prob.considerGrain && g.orientation !== 0 && stockOri !== 0) {
            if (g.orientation === stockOri) rotOk = false; else normalOk = false;
        }
        return (normalOk ? 1 : 0) | (rotOk ? 2 : 0);
    }

    // ------------------------------------------------------------------
    // 2) تقطيع لوح واحد (guillotine) بمعاملات قابلة للتغيير
    //    P = { mode:0..5, split:0..3, parity:0|1, noise:0..1, rnd }
    // ------------------------------------------------------------------
    function packSheet(prob, st, cnt, P) {
        var kerf = prob.kerf, minTrim = prob.minTrim, groups = prob.groups, G = groups.length;
        var rnd = P.rnd;
        var tiles = [], cuts = [], nextId = 1;

        function mk(x, y, w, h) {
            var t = {
                id: nextId++, requestObjId: null, x: x, y: y, width: w, height: h,
                hasChildren: false, final: false, rotated: false, label: null,
                orientation: st.orientation, edge: null
            };
            tiles.push(t);
            return t;
        }
        function fin(t, g, rot) {
            t.final = true; t.isFinal = true;
            t.requestObjId = g.requestObjId; t.label = g.label;
            t.rotated = rot; t.isRotated = rot;
            t.orientation = g.orientation; t.edge = g.edge;
        }
        function addCut(orig, x1, y1, x2, y2, coord, horiz, c1, c2) {
            cuts.push({
                originalTileId: orig.id, originalWidth: orig.width, originalHeight: orig.height,
                x1: x1, y1: y1, x2: x2, y2: y2, cutCoord: coord,
                horizontal: horiz, isHorizontal: horiz,
                child1TileId: c1.id, child2TileId: c2 ? c2.id : -1
            });
        }

        function splitX(node, g, rot, pw, ph, dh, isTop) { // قصة رأسية الأول
            node.hasChildren = true;
            var rightW = Math.max(0, node.width - pw - kerf);
            var c1 = mk(node.x, node.y, pw, node.height);
            var c2 = rightW > minTrim ? mk(node.x + pw + kerf, node.y, rightW, node.height) : null;
            addCut(node, node.x + pw, node.y, node.x + pw, node.y + node.height, pw, true, c1, c2);
            if (dh > EPS) {
                c1.hasChildren = true;
                var topH = Math.max(0, c1.height - ph - kerf);
                var p = mk(c1.x, c1.y, pw, ph); fin(p, g, rot);
                var t = topH > minTrim ? mk(c1.x, c1.y + ph + kerf, pw, topH) : null;
                addCut(c1, c1.x, c1.y + ph, c1.x + c1.width, c1.y + ph, ph, false, p, t);
                if (t) packNode(t, false);
            } else {
                fin(c1, g, rot);
            }
            if (c2) packNode(c2, isTop);
        }
        function splitYonly(node, g, rot, pw, ph, isTop) { // القطعة بعرض الخام كله
            node.hasChildren = true;
            var topH = Math.max(0, node.height - ph - kerf);
            var c1 = mk(node.x, node.y, pw, ph); fin(c1, g, rot);
            var c2 = topH > minTrim ? mk(node.x, node.y + ph + kerf, node.width, topH) : null;
            addCut(node, node.x, node.y + ph, node.x + node.width, node.y + ph, ph, false, c1, c2);
            if (c2) packNode(c2, isTop);
        }
        function splitY(node, g, rot, pw, ph, dw, isTop) { // قصة أفقية الأول
            node.hasChildren = true;
            var topH = Math.max(0, node.height - ph - kerf);
            var c1 = mk(node.x, node.y, node.width, ph);
            var c2 = topH > minTrim ? mk(node.x, node.y + ph + kerf, node.width, topH) : null;
            addCut(node, node.x, node.y + ph, node.x + node.width, node.y + ph, ph, false, c1, c2);
            if (dw > EPS) {
                c1.hasChildren = true;
                var rightW = Math.max(0, c1.width - pw - kerf);
                var p = mk(c1.x, c1.y, pw, ph); fin(p, g, rot);
                var r = rightW > minTrim ? mk(c1.x + pw + kerf, c1.y, rightW, ph) : null;
                addCut(c1, c1.x + pw, c1.y, c1.x + pw, c1.y + c1.height, pw, true, p, r);
                if (r) packNode(r, false);
            } else {
                fin(c1, g, rot);
            }
            if (c2) packNode(c2, isTop);
        }
        function splitXonly(node, g, rot, pw, ph, isTop) { // القطعة بارتفاع الخام كله
            node.hasChildren = true;
            var rightW = Math.max(0, node.width - pw - kerf);
            var c1 = mk(node.x, node.y, pw, ph); fin(c1, g, rot);
            var c2 = rightW > minTrim ? mk(node.x + pw + kerf, node.y, rightW, ph) : null;
            addCut(node, node.x + pw, node.y, node.x + pw, node.y + node.height, pw, true, c1, c2);
            if (c2) packNode(c2, isTop);
        }

        function packNode(node, isTop) {
            var cands = [];
            for (var i = 0; i < G; i++) {
                if (cnt[i] <= 0) continue;
                var g = groups[i];
                if (prob.considerMaterial && g.material !== st.material) continue;
                var fm = fitMask(prob, g, node.width, node.height, st.orientation);
                if (!fm) continue;

                var leftW = node.width - 0 - kerf;
                var leftH = node.height - 0 - kerf;
                var rots = [];
                if (fm & 1) rots.push(false);
                if ((fm & 2) && (g.width !== g.height || !(fm & 1))) rots.push(true);

                for (var r = 0; r < rots.length; r++) {
                    var rot = rots[r];
                    var pw = rot ? g.height : g.width;
                    var ph = rot ? g.width : g.height;
                    var exactW = Math.abs(node.width - pw) < 1e-5;
                    var exactH = Math.abs(node.height - ph) < 1e-5;
                    var remW = node.width - pw, remH = node.height - ph;
                    var colsW = Math.min(cnt[i], Math.floor((node.width + kerf) / (pw + kerf)));
                    var rowsH = Math.min(cnt[i], Math.floor((node.height + kerf) / (ph + kerf)));
                    var wUtil = (colsW * pw) / node.width;
                    var hUtil = (rowsH * ph) / node.height;

                    var sibR = false, sibT = false;
                    var lw = node.width - pw - kerf, lh = node.height - ph - kerf;
                    for (var k = 0; k < G; k++) {
                        var avail = (k === i) ? cnt[k] >= 2 : cnt[k] > 0;
                        if (!avail) continue;
                        var sp = groups[k];
                        if (prob.considerMaterial && sp.material !== st.material) continue;
                        if (!sibR && lw > 0 && fitMask(prob, sp, lw, node.height, st.orientation)) sibR = true;
                        if (!sibT && lh > 0 && fitMask(prob, sp, node.width, lh, st.orientation)) sibT = true;
                        if (sibR && sibT) break;
                    }
                    var pairBonus = (sibR ? 50000000 : 0) + (sibT ? 50000000 : 0);
                    var area = pw * ph;
                    var exact = (exactW && exactH);
                    var half = (exactW || exactH);
                    var score;
                    switch (P.mode) {
                        case 0: score = exact ? -1e12 : half ? -1e10 - area : -(pairBonus + Math.max(wUtil, hUtil) * 5000000 + area * 10); break;
                        case 1: score = exact ? -1e12 : half ? -1e10 - area : -(pairBonus + wUtil * 10000000 + area * 10); break;
                        case 2: score = exact ? -1e12 : half ? -1e10 - area : -(pairBonus + hUtil * 10000000 + area * 10); break;
                        case 3: score = exact ? -1e12 : half ? -1e10 - area : Math.min(remW, remH) * 500 - area; break;
                        case 4: score = exact ? -1e12 : half ? -1e10 - area : -area; break;                 // الأكبر مساحة أولًا
                        default: score = exact ? -1e12 : half ? -1e10 - area : -(Math.max(pw, ph) * 1e6 + area); // الأطول ضلع أولًا
                    }
                    cands.push({ i: i, rot: rot, pw: pw, ph: ph, score: score });
                }
            }
            if (!cands.length) return;

            cands.sort(function (a, b) { return a.score - b.score; });
            var pick = cands[0];
            if (P.noise > 0 && pick.score > -1e12 && cands.length > 1 && rnd() < P.noise) {
                pick = cands[Math.min(cands.length - 1, Math.floor(rnd() * Math.min(3, cands.length)))];
            }

            var gi = pick.i, g = groups[gi], rot = pick.rot, pw = pick.pw, ph = pick.ph;
            var remSame = cnt[gi];
            cnt[gi]--;
            var dw = node.width - pw, dh = node.height - ph;

            if (dw <= EPS && dh <= EPS) { fin(node, g, rot); return; }

            var colsC = Math.min(remSame, Math.floor((node.width + kerf) / (pw + kerf)));
            var rowsC = Math.min(remSame, Math.floor((node.height + kerf) / (ph + kerf)));
            var wUtilC = (colsC * pw) / node.width;
            var hUtilC = (rowsC * ph) / node.height;

            var xFirst;
            if (isTop && prob.cutPref === 1) xFirst = false;          // تفضيل القص العرضي: شرايح بعرض اللوح
            else if (isTop && prob.cutPref === 2) xFirst = true;      // تفضيل القص الطولي
            else if (P.split === 1) xFirst = (dw < dh);
            else if (P.split === 2) xFirst = (dw >= dh);
            else if (P.split === 3) xFirst = rnd() < 0.5;
            else if (colsC >= 2 && wUtilC >= hUtilC) xFirst = false;
            else if (rowsC >= 2 && hUtilC > wUtilC) xFirst = true;
            else if (P.parity === 0) xFirst = (dw < dh);
            else xFirst = (dw >= dh);

            if (xFirst) {
                if (dw > EPS) splitX(node, g, rot, pw, ph, dh, isTop);
                else splitYonly(node, g, rot, pw, ph, isTop);
            } else {
                if (dh > EPS) splitY(node, g, rot, pw, ph, dw, isTop);
                else splitXonly(node, g, rot, pw, ph, isTop);
            }
        }

        var root = mk(0, 0, st.width, st.height);
        packNode(root, true);

        var used = 0, placed = 0;
        for (var t = 0; t < tiles.length; t++) {
            if (!tiles[t].hasChildren && tiles[t].final) { used += tiles[t].width * tiles[t].height; placed++; }
        }
        return { tiles: tiles, cuts: cuts, usedArea: used, placed: placed, stock: st };
    }

    // ------------------------------------------------------------------
    // 3) بناء حل كامل (لوح ورا لوح) باستراتيجية معينة
    // ------------------------------------------------------------------
    var DET_COMBOS = [];
    (function () {
        for (var m = 0; m < 6; m++) { DET_COMBOS.push({ mode: m, split: 0, parity: 0, noise: 0 }); DET_COMBOS.push({ mode: m, split: 0, parity: 1, noise: 0 }); }
        for (var m2 = 0; m2 < 6; m2++) { DET_COMBOS.push({ mode: m2, split: 1, parity: 0, noise: 0 }); DET_COMBOS.push({ mode: m2, split: 2, parity: 0, noise: 0 }); }
    })();

    function betterAttempt(prob, a, b) { // هل a أحسن من b ؟
        if (!b) return true;
        var tol = (prob.priority === 1 ? 0.03 : 0.0005) * a.stock.area;
        if (a.usedArea > b.usedArea + tol) return true;
        if (a.usedArea < b.usedArea - tol) return false;
        if (a.cuts.length !== b.cuts.length) return a.cuts.length < b.cuts.length;
        return a.usedArea > b.usedArea;
    }

    function sumCnt(c) { var s = 0; for (var i = 0; i < c.length; i++) s += c[i]; return s; }

    function bestOnStock(prob, st, cnt, S) {
        var best = null, bestCnt = null;
        var combos;
        if (S.det) {
            combos = DET_COMBOS;
        } else {
            combos = [];
            for (var a = 0; a < S.attempts; a++) {
                combos.push({
                    mode: Math.floor(S.rnd() * 6), split: Math.floor(S.rnd() * 4),
                    parity: S.rnd() < 0.5 ? 0 : 1, noise: 0.15 + S.rnd() * 0.45
                });
            }
        }
        for (var c = 0; c < combos.length; c++) {
            var cc = cnt.slice();
            var P = { mode: combos[c].mode, split: combos[c].split, parity: combos[c].parity, noise: combos[c].noise, rnd: S.rnd };
            var att = packSheet(prob, st, cc, P);
            if (att.placed > 0 && betterAttempt(prob, att, best)) { best = att; bestCnt = cc; }
        }
        return best ? { att: best, cnt: bestCnt } : null;
    }

    function buildSolution(prob, S) {
        var cnt = prob.groups.map(function (g) { return g.count; });
        var used = prob.stocks.map(function () { return 0; });
        var sheets = [];
        var guard = 0;

        while (sumCnt(cnt) > 0 && guard++ < 6000) {
            if (prob.single && sheets.length >= 1) break;

            var cands = [];
            for (var s = 0; s < prob.stocks.length; s++) {
                if (used[s] >= prob.stocks[s].count) continue;
                var st = prob.stocks[s];
                var feasible = false;
                for (var g = 0; g < prob.groups.length; g++) {
                    if (cnt[g] <= 0) continue;
                    if (prob.considerMaterial && prob.groups[g].material !== st.material) continue;
                    if (fitMask(prob, prob.groups[g], st.width, st.height, st.orientation)) { feasible = true; break; }
                }
                if (feasible) cands.push(s);
            }
            if (!cands.length) break;

            var order = S.stockOrder;
            if (prob.priority === 2 && !prob.single) order = 'smallest';
            if (prob.single) order = 'best';

            var chosen = null, chosenIdx = -1;
            if (order === 'largest' || order === 'smallest') {
                cands.sort(function (a, b) {
                    var d = prob.stocks[a].area - prob.stocks[b].area;
                    return order === 'largest' ? -d : d;
                });
                // نجرب أول نوع فيه قطعة تتحط فعلًا
                for (var ci = 0; ci < cands.length && !chosen; ci++) {
                    var r1 = bestOnStock(prob, prob.stocks[cands[ci]], cnt, S);
                    if (r1) { chosen = r1; chosenIdx = cands[ci]; }
                }
            } else {
                var remaining = sumCnt(cnt);
                var fullBest = null, fullIdx = -1, partBest = null, partIdx = -1;
                for (var cj = 0; cj < cands.length; cj++) {
                    var rr = bestOnStock(prob, prob.stocks[cands[cj]], cnt, S);
                    if (!rr) continue;
                    if (rr.att.placed >= remaining) {
                        if (!fullBest || prob.stocks[cands[cj]].area < prob.stocks[fullIdx].area) { fullBest = rr; fullIdx = cands[cj]; }
                    } else {
                        if (!partBest || rr.att.usedArea > partBest.att.usedArea + 1e-6 ||
                            (Math.abs(rr.att.usedArea - partBest.att.usedArea) <= 1e-6 && prob.stocks[cands[cj]].area < prob.stocks[partIdx].area)) {
                            partBest = rr; partIdx = cands[cj];
                        }
                    }
                }
                if (fullBest) { chosen = fullBest; chosenIdx = fullIdx; } else { chosen = partBest; chosenIdx = partIdx; }
            }
            if (!chosen) break;
            used[chosenIdx]++;
            cnt = chosen.cnt;
            sheets.push(chosen.att);
        }

        // تحسين اللوح الأخير: لو فيه خام أصغر ينفع يشيل نفس القطع نبدّله
        if (!prob.single && sheets.length && prob.priority !== 1) {
            var last = sheets[sheets.length - 1];
            var lastCnt = prob.groups.map(function () { return 0; });
            last.tiles.forEach(function (t) {
                if (!t.hasChildren && t.final) {
                    for (var gi = 0; gi < prob.groups.length; gi++) {
                        if (prob.groups[gi].requestObjId === t.requestObjId) { lastCnt[gi]++; break; }
                    }
                }
            });
            var lastTypeIdx = prob.stocks.indexOf(last.stock);
            for (var s2 = 0; s2 < prob.stocks.length; s2++) {
                var st2 = prob.stocks[s2];
                if (st2.area >= last.stock.area) continue;
                if (used[s2] - (s2 === lastTypeIdx ? 1 : 0) >= st2.count) continue;
                var tryCnt = lastCnt.slice();
                var swapped = bestOnStock(prob, st2, tryCnt, { det: true, rnd: S.rnd, attempts: 0 });
                if (swapped && sumCnt(swapped.cnt) === 0 && swapped.att.placed === last.placed) {
                    used[lastTypeIdx]--; used[s2]++;
                    sheets[sheets.length - 1] = swapped.att;
                    last = swapped.att; lastTypeIdx = s2;
                }
            }
        }

        var unplaced = sumCnt(cnt), unplacedArea = 0, stockArea = 0, nCuts = 0;
        for (var gI = 0; gI < prob.groups.length; gI++) unplacedArea += cnt[gI] * prob.groups[gI].width * prob.groups[gI].height;
        sheets.forEach(function (sh) { stockArea += sh.stock.area; nCuts += sh.cuts.length; });
        return { sheets: sheets, remaining: cnt, unplaced: unplaced, unplacedArea: unplacedArea, stockArea: stockArea, nCuts: nCuts };
    }

    function solBetter(prob, a, b) {
        if (!b) return true;
        if (Math.abs(a.unplacedArea - b.unplacedArea) > 1e-6) return a.unplacedArea < b.unplacedArea;
        if (prob.priority === 1) {
            if (a.nCuts !== b.nCuts) return a.nCuts < b.nCuts;
            if (Math.abs(a.stockArea - b.stockArea) > 1e-6) return a.stockArea < b.stockArea;
            return false;
        }
        if (Math.abs(a.stockArea - b.stockArea) > 1e-6) return a.stockArea < b.stockArea;
        if (a.nCuts !== b.nCuts) return a.nCuts < b.nCuts;
        return false;
    }

    // ------------------------------------------------------------------
    // 4) تحويل الحل لنفس شكل الـ solution اللي الواجهة متعودة عليه
    // ------------------------------------------------------------------
    function buildOutput(prob, sol, taskId, elapsed) {
        var request = prob.request;
        var mosaics = [];

        sol.sheets.forEach(function (sh) {
            var stock = sh.stock, tiles = sh.tiles, cuts = sh.cuts;
            var stockArea = stock.area;
            var nbrFinal = 0, nbrWasted = 0, mosaicPanelsMap = {}, mosaicEdgeBands = {};

            tiles.forEach(function (t) {
                if (t.hasChildren) return;
                if (t.final) {
                    nbrFinal++;
                    if (!mosaicPanelsMap[t.requestObjId]) {
                        mosaicPanelsMap[t.requestObjId] = {
                            requestObjId: t.requestObjId,
                            width: t.rotated ? t.height : t.width,
                            height: t.rotated ? t.width : t.height,
                            label: t.label, count: 0
                        };
                    }
                    mosaicPanelsMap[t.requestObjId].count++;
                    if (prob.hasEdgeBanding && t.edge) {
                        var ow = t.rotated ? t.height : t.width;
                        var oh = t.rotated ? t.width : t.height;
                        if (t.edge.top) mosaicEdgeBands[t.edge.top] = (mosaicEdgeBands[t.edge.top] || 0) + ow;
                        if (t.edge.bottom) mosaicEdgeBands[t.edge.bottom] = (mosaicEdgeBands[t.edge.bottom] || 0) + ow;
                        if (t.edge.left) mosaicEdgeBands[t.edge.left] = (mosaicEdgeBands[t.edge.left] || 0) + oh;
                        if (t.edge.right) mosaicEdgeBands[t.edge.right] = (mosaicEdgeBands[t.edge.right] || 0) + oh;
                    }
                } else {
                    nbrWasted++;
                }
            });

            var cutLength = 0;
            cuts.forEach(function (c) { cutLength += Math.hypot(c.x2 - c.x1, c.y2 - c.y1); });

            mosaics.push({
                requestStockId: stock.requestObjId,
                stockLabel: stock.label,
                material: stock.rawMaterial,
                usedArea: sh.usedArea,
                wastedArea: Math.max(0, stockArea - sh.usedArea),
                usedAreaRatio: stockArea > 0 ? (sh.usedArea / stockArea) : 0,
                cuts: cuts,
                cutLength: cutLength,
                nbrFinalPanels: nbrFinal,
                nbrWastedPanels: nbrWasted,
                edgeBands: mosaicEdgeBands,
                panels: Object.keys(mosaicPanelsMap).map(function (k) { return mosaicPanelsMap[k]; }),
                tiles: tiles
            });
        });

        var totalUsedArea = 0, totalWastedArea = 0, totalNbrCuts = 0, totalCutLength = 0;
        var globalEdgeBands = {}, usedStockMap = {};
        mosaics.forEach(function (m) {
            totalUsedArea += m.usedArea;
            totalWastedArea += m.wastedArea;
            totalNbrCuts += m.cuts.length;
            totalCutLength += m.cutLength;
            Object.keys(m.edgeBands || {}).forEach(function (k) {
                globalEdgeBands[k] = (globalEdgeBands[k] || 0) + m.edgeBands[k];
            });
            var sid = m.requestStockId;
            if (!usedStockMap[sid]) {
                usedStockMap[sid] = {
                    requestObjId: sid, width: m.tiles[0].width, height: m.tiles[0].height,
                    label: m.stockLabel, material: m.material, count: 0, enabled: true
                };
            }
            usedStockMap[sid].count++;
        });

        var noFit = [];
        prob.groups.forEach(function (g, i) {
            if (sol.remaining[i] > 0) {
                noFit.push({
                    id: g.requestObjId, width: g.width, height: g.height,
                    label: g.label, material: g.rawMaterial, count: sol.remaining[i]
                });
            }
        });

        var totalArea = totalUsedArea + totalWastedArea;
        return {
            id: 'sol-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
            taskId: taskId,
            version: '1.126',
            elapsedTime: elapsed,
            solutionElapsedTime: elapsed,
            totalUsedArea: totalUsedArea,
            totalWastedArea: totalWastedArea,
            totalUsedAreaRatio: totalArea > 0 ? (totalUsedArea / totalArea) : 0,
            totalNbrCuts: totalNbrCuts,
            totalCutLength: totalCutLength,
            edgeBands: globalEdgeBands,
            request: request,
            mosaics: mosaics,
            panels: Object.keys(prob.panelSummaryMap).map(function (k) { return prob.panelSummaryMap[k]; }),
            usedStockPanels: Object.keys(usedStockMap).map(function (k) { return usedStockMap[k]; }),
            noFitPanels: noFit
        };
    }

    // ------------------------------------------------------------------
    // 5) المهمة: بحث تدريجي (anytime) زي الموقع — بيحدّث أحسن حل أول بأول
    // ------------------------------------------------------------------
    function runTask(request, taskId) {
        var prob = prepareProblem(request);
        var task = {
            initPercentage: 100, percentageDone: 0, status: 'RUNNING', solution: null, _stop: false
        };
        tasksStore[taskId] = task;

        var rnd = makeRng(20240601 + prob.pieceCount * 31 + prob.stocks.length);
        var n = prob.pieceCount;
        var budget = Math.min(8000, (1200 + Math.min(4800, n * 30)) * prob.level);
        var minTime = Math.min(500, budget);
        var t0 = Date.now();
        var iter = 0, lastImprove = 0;
        var best = null;
        var detOrders = ['best', 'largest', 'smallest'];

        function finish() {
            if (!best) {
                best = { sheets: [], remaining: prob.groups.map(function (g) { return g.count; }), unplaced: n, unplacedArea: prob.pieceArea, stockArea: 0, nCuts: 0 };
            }
            task.solution = buildOutput(prob, best, taskId, Date.now() - t0);
            task.percentageDone = 100;
            task.status = 'FINISHED';
        }

        function tick() {
            if (task._stop || task.status !== 'RUNNING') { if (task.status === 'RUNNING') finish(); return; }
            var slice = Date.now() + 30;
            var improved = false;
            do {
                var S;
                if (iter < detOrders.length) {
                    S = { det: true, stockOrder: detOrders[iter], rnd: rnd, attempts: 0 };
                } else {
                    var r = rnd();
                    S = { det: false, stockOrder: r < 0.5 ? 'best' : (r < 0.75 ? 'largest' : 'smallest'), rnd: rnd, attempts: 3 };
                }
                var sol = buildSolution(prob, S);
                iter++;
                if (solBetter(prob, sol, best)) { best = sol; improved = true; lastImprove = iter; }
            } while (Date.now() < slice && !task._stop);

            var elapsed = Date.now() - t0;
            if (improved || !task.solution) {
                task.solution = buildOutput(prob, best, taskId, elapsed);
            }
            task.percentageDone = Math.min(99, Math.floor(100 * elapsed / budget));

            var stagnant = (iter - lastImprove) > (120 + 8 * n) && elapsed > minTime;
            if (elapsed >= budget || stagnant || prob.groups.length === 0 || prob.stocks.length === 0) {
                finish();
            } else {
                setTimeout(tick, 4);
            }
        }
        setTimeout(tick, 0);
    }

    // Expose window.android bridge matching com.cutlistoptimizer v1.126
    window.android = {
        compute: function (jsonDataStr) {
            try {
                var req = JSON.parse(jsonDataStr);
                var taskId = 'task-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
                runTask(req, taskId);
                return JSON.stringify({ statusCode: 0, taskId: taskId });
            } catch (e) {
                console.error("Native solver error:", e);
                return JSON.stringify({ statusCode: 4, taskId: null });
            }
        },
        getTaskStatus: function (taskId) {
            var t = tasksStore[taskId];
            if (!t) {
                return JSON.stringify({ initPercentage: 100, percentageDone: 100, status: 'FINISHED', solution: null });
            }
            return JSON.stringify({
                initPercentage: t.initPercentage,
                percentageDone: t.percentageDone,
                status: t.status,
                solution: t.solution
            });
        },
        stopTask: function (taskId) {
            var t = tasksStore[taskId];
            if (t && t.status === 'RUNNING') {
                t._stop = true;
            }
        },
        getAppVersion: function () { return "1.126"; },
        getBuildTimestamp: function () { return "2026-10-25"; },
        getDeviceId: function () { return "local-android-device-pro"; },
        isFull: function () { return true; },
        getNbrTotalCalculations: function () { return 0; },
        getNbrWeekCalculations: function () { return 0; },
        getNbrDayCalculations: function () { return 0; },
        getWeekCalculationsThreshold: function () { return 999999; },
        getDayCalculationsThreshold: function () { return 999999; },
        getTotalCalculationsThreshold: function () { return 999999; },
        setClientId: function () {},
        setUserAccessToken: function () {},
        setSubscriptionPlanLevel: function () {},
        setModalVisible: function () {},
        onModalOpen: function () {},
        onModalClose: function () {},
        onPlanChoice: function () {},
        donate: function () {
            showInPageNotice("النسخة الاحترافية (Pro) مفعلة مجاناً بالكامل!", false);
        },
        consumeIap: function () {},
        signinWithGoogle: function () {
            showInPageNotice("قاعدة البيانات المحلية مفعلة بدون الحاجة لحساب خارجي", false);
        },
        logout: function () {},
        showToast: function (msg) {
            showInPageNotice(msg, false);
        },
        showProgressDialog: function (msg) {
            showInPageNotice(msg, false);
        },
        dismissProgressDialog: function () {},
        saveCsv: function (csvContent, filename) {
            try {
                var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                download(blob, filename || 'cutlist.csv', 'text/csv');
                showInPageNotice("تم حفظ ملف CSV: " + (filename || 'cutlist.csv'), false);
            } catch (e) {
                console.error("saveCsv error:", e);
            }
        },
        saveImage: function (imgDataUrl, filename) {
            try {
                download(imgDataUrl, filename || 'cutlist.jpeg', 'image/jpeg');
                showInPageNotice("تم حفظ الصورة: " + (filename || 'cutlist.jpeg'), false);
            } catch (e) {
                console.error("saveImage error:", e);
            }
        },
        savePdf: function (pdfDataUrl, filename) {
            try {
                download(pdfDataUrl, filename || 'cutlist.pdf', 'application/pdf');
                showInPageNotice("تم حفظ ملف PDF: " + (filename || 'cutlist.pdf'), false);
            } catch (e) {
                console.error("savePdf error:", e);
            }
        }
    };

    try {
        localStorage.setItem("isFull", "true");
        localStorage.setItem("useLocalStorageAsRepository", "true");
    } catch (e) {}
})();
