app.service('ProjectService', ['TilingData', 'DimensionProcessor', '$translate', 'CsvHandler', 'ClientInfo', '$http', 'CutListCfg', 'AuthService', '$q',
    function(TilingData, DimensionProcessor, $translate, CsvHandler, ClientInfo, $http, CutListCfg, AuthService, $q) {

    var SAVED_PROJECT_PREFIX = "project-";
    var self = this;
    self.projects = [];

    function sanitizePanelArray(arr) {
        var copy = JSON.parse(JSON.stringify(arr || []));
        copy.forEach(function (panel) {
            for (var attribute in panel) {
                if (['id', 'width', 'height', 'label', 'count', 'enabled', 'orientation', 'material', 'edge'].indexOf(attribute) === -1) {
                    delete panel[attribute];
                }
            }
        });
        return copy;
    }

    function buildProjectData(panels, stockPanels, configuration, clientMeta) {
        var projectData = TilingData.data ? JSON.parse(JSON.stringify(TilingData.data)) : {};
        var panelsCopy = sanitizePanelArray(panels);
        var stockPanelsCopy = sanitizePanelArray(stockPanels);

        projectData = projectData || {};
        projectData.workspace = {
            panels: panelsCopy,
            stockPanels: stockPanelsCopy,
            configuration: JSON.parse(JSON.stringify(configuration || {})),
            clientInfo: ClientInfo,
            clientMeta: clientMeta || {}
        };
        projectData.request = projectData.workspace;
        return projectData;
    }

    function seedDefaultProjectsIfNeeded() {
        try {
            if (localStorage.getItem("clo_local_db_seeded_v1") === "true") {
                return;
            }
            var hasAny = false;
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith(SAVED_PROJECT_PREFIX)) {
                    hasAny = true;
                    break;
                }
            }
            if (!hasAny) {
                var nowIso = new Date().toISOString();
                var sample1 = {
                    id: "proj-sample-1",
                    name: "مشروع مطبخ - العميل أحمد محمود (Kitchen Cabinet)",
                    clientName: "أحمد محمود",
                    clientPhone: "01012345678",
                    notes: "خشب MDF 18mm أبيض + شريط حواف PVC 1mm",
                    created: nowIso,
                    updated: nowIso,
                    data: {
                        workspace: {
                            panels: [
                                { id: 1, height: 800, width: 600, count: 4, label: "جانب خزانة (Side)", material: "MDF 18mm", enabled: true, orientation: 2, edge: { top: "PVC 1mm", bottom: "PVC 1mm", left: "PVC 1mm", right: null } },
                                { id: 2, height: 1000, width: 500, count: 3, label: "رف داخلي (Shelf)", material: "MDF 18mm", enabled: true, orientation: 1, edge: { top: "PVC 1mm", bottom: null, left: null, right: null } },
                                { id: 3, height: 750, width: 495, count: 4, label: "ضلفة باب (Door)", material: "MDF 18mm", enabled: true, orientation: 2, edge: { top: "PVC 1mm", bottom: "PVC 1mm", left: "PVC 1mm", right: "PVC 1mm" } },
                                { id: 4, height: 450, width: 180, count: 4, label: "وش درج (Drawer)", material: "MDF 18mm", enabled: true, orientation: 1, edge: { top: "PVC 1mm", bottom: "PVC 1mm", left: "PVC 1mm", right: "PVC 1mm" } }
                            ],
                            stockPanels: [
                                { id: 1001, height: 2440, width: 1220, count: 5, label: "لوح MDF 244×122", material: "MDF 18mm", enabled: true, orientation: 2 }
                            ],
                            configuration: {
                                version: 1.0,
                                cutThickness: 4,
                                cutThicknessInput: "4",
                                useSingleStockUnit: false,
                                accuracyFactor: 0,
                                optimizationPriority: 0,
                                cutOrientationPreference: 0,
                                optimizationFactor: 1,
                                showDimensions: true,
                                isTileLabelVisible: true,
                                isMaterialEnabled: true,
                                units: 1,
                                considerOrientation: true,
                                hasEdgeBanding: true,
                                decimalPlaces: 2,
                                forceServerSideCalc: false,
                                minTrimDimension: 0,
                                stackEqualMosaicLayout: 0,
                                isWidthFirst: false
                            }
                        }
                    }
                };
                sample1.data.request = sample1.data.workspace;

                var sample2 = {
                    id: "proj-sample-2",
                    name: "دولاب ملابس - العميل م. محمد علي (Wardrobe)",
                    clientName: "م. محمد علي",
                    clientPhone: "01287654321",
                    notes: "كونتر أرو 18 مم - تقسيم الضلف والقواطع",
                    created: nowIso,
                    updated: nowIso,
                    data: {
                        workspace: {
                            panels: [
                                { id: 1, height: 2200, width: 600, count: 3, label: "قائم دولاب (Side)", material: "Plywood 18mm", enabled: true, orientation: 2, edge: { top: "Oak Band", bottom: "Oak Band", left: "Oak Band", right: null } },
                                { id: 2, height: 1164, width: 600, count: 2, label: "سقف وقاعدة (Top/Base)", material: "Plywood 18mm", enabled: true, orientation: 1, edge: { top: "Oak Band", bottom: null, left: null, right: null } },
                                { id: 3, height: 573, width: 580, count: 6, label: "رف تخزين (Shelf)", material: "Plywood 18mm", enabled: true, orientation: 1, edge: { top: "Oak Band", bottom: null, left: null, right: null } }
                            ],
                            stockPanels: [
                                { id: 1001, height: 2440, width: 1220, count: 6, label: "لوح كونتر 244×122", material: "Plywood 18mm", enabled: true, orientation: 2 }
                            ],
                            configuration: {
                                version: 1.0,
                                cutThickness: 3.2,
                                cutThicknessInput: "3.2",
                                useSingleStockUnit: false,
                                accuracyFactor: 0,
                                optimizationPriority: 0,
                                cutOrientationPreference: 0,
                                optimizationFactor: 1,
                                showDimensions: true,
                                isTileLabelVisible: true,
                                isMaterialEnabled: true,
                                units: 1,
                                considerOrientation: true,
                                hasEdgeBanding: true,
                                decimalPlaces: 2,
                                forceServerSideCalc: false,
                                minTrimDimension: 0,
                                stackEqualMosaicLayout: 0,
                                isWidthFirst: false
                            }
                        }
                    }
                };
                sample2.data.request = sample2.data.workspace;

                localStorage.setItem(SAVED_PROJECT_PREFIX + sample1.name, LZString.compressToUTF16(JSON.stringify(sample1)));
                localStorage.setItem(SAVED_PROJECT_PREFIX + sample2.name, LZString.compressToUTF16(JSON.stringify(sample2)));
                localStorage.setItem("clo_local_db_seeded_v1", "true");
            }
        } catch (e) {
            console.warn("Could not seed default projects:", e);
        }
    }

    function readRawProject(key) {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        var project = null;
        try {
            var decompressed = LZString.decompressFromUTF16(raw);
            if (decompressed && decompressed.charAt(0) === '{') {
                project = JSON.parse(decompressed);
            }
        } catch (e) {}
        if (!project) {
            try {
                project = JSON.parse(raw);
            } catch (e2) {}
        }
        if (project) {
            var cleanName = self.getProjectNameFromKey(project.name || key);
            project.name = cleanName;
            if (!project.id) {
                project.id = cleanName;
            }
            if (!project.created) {
                project.created = new Date().toISOString();
            }
            if (!project.updated) {
                project.updated = project.created;
            }
        }
        return project;
    }

    function writeRawProject(project) {
        var cleanName = self.getProjectNameFromKey(project.name);
        project.name = cleanName;
        if (!project.id) project.id = cleanName;
        project.updated = new Date().toISOString();
        if (!project.created) project.created = project.updated;
        localStorage.setItem(SAVED_PROJECT_PREFIX + cleanName, LZString.compressToUTF16(JSON.stringify(project)));
    }

    self.saveLocalProjects2Server = function () {
        var deferred = $q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    self.loadSavedProjects = function () {
        var deferred = $q.defer();
        seedDefaultProjectsIfNeeded();
        self.projects.length = 0;
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (typeof key === 'string' && key.startsWith(SAVED_PROJECT_PREFIX)) {
                    var project = readRawProject(key);
                    if (project) {
                        self.projects.push(project);
                    }
                }
            }
            self.projects.sort(function(a, b) {
                return new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime();
            });
        } catch (e) {
            console.error("Error loading projects from localStorage:", e);
        }
        deferred.resolve({ data: self.projects });
        return deferred.promise;
    };

    self.loadProjectFromServer = function(idOrName) {
        var deferred = $q.defer();
        self.loadSavedProjects().then(function() {
            var found = self.projects.find(function(p) {
                return p.id === idOrName || p.name === idOrName || (SAVED_PROJECT_PREFIX + p.name) === idOrName;
            });
            if (!found) {
                var byKey = readRawProject(SAVED_PROJECT_PREFIX + self.getProjectNameFromKey(String(idOrName)));
                if (byKey) found = byKey;
            }
            if (found) {
                if (typeof found.data === 'string') {
                    try { found.data = JSON.parse(found.data); } catch(e) {}
                }
                deferred.resolve({ data: found });
            } else {
                deferred.reject({ status: 404, data: { message: "Project not found in local database" } });
            }
        });
        return deferred.promise;
    };

    self.loadProject = function (projectData, tiles, stockTiles, cfg) {
        var deferred = $q.defer();
        try {
            var workspace = (projectData && (projectData.workspace || projectData.request)) || projectData;
            if (workspace && workspace.panels) {
                tiles.length = 0;
                Array.prototype.push.apply(tiles, JSON.parse(JSON.stringify(workspace.panels)));
            }
            if (workspace && workspace.stockPanels) {
                stockTiles.length = 0;
                Array.prototype.push.apply(stockTiles, JSON.parse(JSON.stringify(workspace.stockPanels)));
            }
            if (workspace && workspace.configuration) {
                Object.assign(cfg, JSON.parse(JSON.stringify(workspace.configuration)));
            }
            if (projectData && projectData.mosaics) {
                TilingData.data = projectData;
            } else {
                TilingData.clear();
            }
            deferred.resolve();
        } catch (e) {
            console.error("Error loading project:", e);
            deferred.reject(e);
        }
        return deferred.promise;
    };

    self.overwriteProject = function (id, name, panels, stockPanels, configuration, clientMeta) {
        var deferred = $q.defer();
        try {
            var cleanName = self.getProjectNameFromKey(name || id);
            var existing = readRawProject(SAVED_PROJECT_PREFIX + cleanName);
            var projectData = buildProjectData(panels, stockPanels, configuration, clientMeta || (existing && existing.clientMeta));
            var record = {
                id: (existing && existing.id) || id || cleanName,
                name: cleanName,
                clientName: (clientMeta && clientMeta.clientName) || (existing && existing.clientName) || "",
                clientPhone: (clientMeta && clientMeta.clientPhone) || (existing && existing.clientPhone) || "",
                notes: (clientMeta && clientMeta.notes) || (existing && existing.notes) || "",
                created: (existing && existing.created) || new Date().toISOString(),
                updated: new Date().toISOString(),
                data: projectData
            };
            writeRawProject(record);
            self.loadSavedProjects();
            deferred.resolve({ data: { id: record.id, name: record.name } });
        } catch (e) {
            deferred.reject(e);
        }
        return deferred.promise;
    };

    self.saveProject = function (id, name, panels, stockPanels, configuration, clientMeta) {
        var deferred = $q.defer();
        try {
            var cleanName = self.getProjectNameFromKey(name);
            var existing = readRawProject(SAVED_PROJECT_PREFIX + cleanName);
            if (existing !== null && existing.id !== id) {
                if (!confirm($translate.instant('OVERWRITE') + "?\n" + cleanName)) {
                    deferred.reject({ status: 409 });
                    return deferred.promise;
                }
            }
            var projectData = buildProjectData(panels, stockPanels, configuration, clientMeta);
            var record = {
                id: (existing && existing.id) || id || ("proj-" + Date.now()),
                name: cleanName,
                clientName: (clientMeta && clientMeta.clientName) || (existing && existing.clientName) || "",
                clientPhone: (clientMeta && clientMeta.clientPhone) || (existing && existing.clientPhone) || "",
                notes: (clientMeta && clientMeta.notes) || (existing && existing.notes) || "",
                created: (existing && existing.created) || new Date().toISOString(),
                updated: new Date().toISOString(),
                data: projectData
            };
            writeRawProject(record);
            self.loadSavedProjects();
            deferred.resolve({ data: { id: record.id, name: record.name } });
        } catch (e) {
            console.error("Error saving project to local DB:", e);
            deferred.reject(e);
        }
        return deferred.promise;
    };

    self.saveProjectLocalStorage = function (name, panels, stockPanels, configuration, clientMeta) {
        return self.saveProject(null, name, panels, stockPanels, configuration, clientMeta);
    };

    self.deleteProject = function (project) {
        var deferred = $q.defer();
        try {
            var cleanName = self.getProjectNameFromKey(project.name || project.id);
            localStorage.removeItem(SAVED_PROJECT_PREFIX + cleanName);
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && k.startsWith(SAVED_PROJECT_PREFIX)) {
                    var p = readRawProject(k);
                    if (p && (p.id === project.id || p.name === cleanName)) {
                        localStorage.removeItem(k);
                    }
                }
            }
            var index = self.projects.indexOf(project);
            if (index > -1) {
                self.projects.splice(index, 1);
            }
            self.loadSavedProjects();
            deferred.resolve({ data: { deleted: cleanName } });
        } catch (e) {
            deferred.reject(e);
        }
        return deferred.promise;
    };

    self.renameProject = function (idOrOldName, newName) {
        var deferred = $q.defer();
        try {
            var cleanNewName = self.getProjectNameFromKey(newName);
            var targetKey = null;
            var targetProject = null;

            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith(SAVED_PROJECT_PREFIX)) {
                    var p = readRawProject(k);
                    if (p && (p.id === idOrOldName || p.name === idOrOldName || k === SAVED_PROJECT_PREFIX + idOrOldName)) {
                        targetKey = k;
                        targetProject = p;
                        break;
                    }
                }
            }

            if (!targetProject && self.projects.length > 0) {
                var memProj = self.projects.find(function(p) { return p.id === idOrOldName || p.name === cleanNewName; });
                if (memProj) {
                    targetProject = memProj;
                    targetKey = SAVED_PROJECT_PREFIX + self.getProjectNameFromKey(memProj.oldName || memProj.name);
                }
            }

            if (targetProject) {
                if (targetKey && targetKey !== SAVED_PROJECT_PREFIX + cleanNewName) {
                    localStorage.removeItem(targetKey);
                }
                targetProject.name = cleanNewName;
                targetProject.updated = new Date().toISOString();
                writeRawProject(targetProject);
                self.loadSavedProjects();
                deferred.resolve({ data: targetProject });
            } else {
                deferred.reject({ status: 404, data: { message: "Project not found" } });
            }
        } catch (e) {
            deferred.reject(e);
        }
        return deferred.promise;
    };

    self.exportAllDatabaseJson = function () {
        self.loadSavedProjects();
        var panelLists = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.startsWith("tiles-")) {
                try { panelLists.push(JSON.parse(localStorage.getItem(k))); } catch(e) {}
            }
        }
        return JSON.stringify({
            app: "CutList Optimizer Local Database",
            version: "1.126",
            exportedAt: new Date().toISOString(),
            projects: self.projects,
            panelLists: panelLists
        }, null, 2);
    };

    self.exportProjectJson = function (name) {
        self.loadSavedProjects();
        var clean = self.getProjectNameFromKey(name);
        var found = (self.projects || []).filter(function (p) { return p && p.name === clean; });
        return JSON.stringify({
            app: "CutList Optimizer Local Database",
            version: "1.126",
            exportedAt: new Date().toISOString(),
            projects: found,
            panelLists: []
        }, null, 2);
    };

    self.importDatabaseJson = function (jsonStr) {
        var parsed = JSON.parse(jsonStr);
        if (parsed.projects && Array.isArray(parsed.projects)) {
            parsed.projects.forEach(function (proj) {
                if (proj && proj.name) {
                    writeRawProject(proj);
                }
            });
        }
        if (parsed.panelLists && Array.isArray(parsed.panelLists)) {
            parsed.panelLists.forEach(function (pl) {
                if (pl && pl.name) {
                    localStorage.setItem("tiles-" + pl.name, JSON.stringify(pl));
                }
            });
        }
        return self.loadSavedProjects();
    };

    self.getProjectNameFromKey = function (key) {
        return String(key || "").replace(new RegExp("^" + SAVED_PROJECT_PREFIX), '');
    };

    self.saveProjectsToLocalStorage = function() {
        try {
            self.projects.forEach(function (project) {
                writeRawProject(project);
            });
        } catch (e) {
            console.error("Error saving projects to localStorage:", e);
        }
    };

    self.removeLocalStorageProjects = function () {};

    self.loadSavedProjects();
}]);
