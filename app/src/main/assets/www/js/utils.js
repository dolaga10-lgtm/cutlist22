if (!Object.assign) {
    Object.defineProperty(Object, 'assign', {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function(target) {
            'use strict';
            if (target === undefined || target === null) {
                throw new TypeError('Cannot convert first argument to object');
            }

            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var nextSource = arguments[i];
                if (nextSource === undefined || nextSource === null) {
                    continue;
                }
                nextSource = Object(nextSource);

                var keysArray = Object.keys(Object(nextSource));
                for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
                    var nextKey = keysArray[nextIndex];
                    var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
                    if (desc !== undefined && desc.enumerable) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
            return to;
        }
    });
}

String.prototype.hashCode = function() {
    var hash = 0, i, chr, len;
    if (this.length === 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    //return hash;
    return (hash >>> 0);    // Ensure a positive number
};

Number.prototype.countDecimals = function () {
    if (Math.floor(this.valueOf()) == this.valueOf()) {
        return 0;
    }
    return this.toString().split(".")[1].length || 0;
};

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
        return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
}

// Same as above Number.prototype.countDecimals but will work for strings
function countDecimals(number) {
    if (!number) {
        return 0;
    }
    if (Math.floor(number.valueOf()) == number.valueOf()) {
        return 0;
    }
    return number.toString().split(".")[1].length || 0;
}

if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function(predicate) {
            // 1. Let O be ? ToObject(this value).
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            var thisArg = arguments[1];

            // 5. Let k be 0.
            var k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return kValue.
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return undefined.
            return undefined;
        }
    });
}

// https://stackoverflow.com/questions/28327510/align-text-right-using-jspdf
var splitRegex = /\r\n|\r|\n/g;
jsPDF.API.textEx = function (text, x, y, hAlign, vAlign) {
    var fontSize = this.internal.getFontSize() / this.internal.scaleFactor;

    // As defined in jsPDF source code
    var lineHeightProportion = 1.15;

    var splittedText = null;
    var lineCount = 1;
    if (vAlign === 'middle' || vAlign === 'bottom' || hAlign === 'center' || hAlign === 'right') {
        splittedText = typeof text === 'string' ? text.split(splitRegex) : text;

        lineCount = splittedText.length || 1;
    }

    // Align the top
    y += fontSize * (2 - lineHeightProportion);

    if (vAlign === 'middle')
        y -= (lineCount / 2) * fontSize;
    else if (vAlign === 'bottom')
        y -= lineCount * fontSize;

    if (hAlign === 'center' || hAlign === 'right') {
        var alignSize = fontSize;
        if (hAlign === 'center')
            alignSize *= 0.5;

        if (lineCount > 1) {
            for (var iLine = 0; iLine < splittedText.length; iLine++) {
                this.text(splittedText[iLine], x - this.getStringUnitWidth(splittedText[iLine]) * alignSize, y);
                y += fontSize;
            }
            return this;
        }
        x -= this.getStringUnitWidth(text) * alignSize;
    }

    this.text(text, x, y);
    return this;
};

if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value: function(searchElement, fromIndex) {

            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            // 1. Let O be ? ToObject(this value).
            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If len is 0, return false.
            if (len === 0) {
                return false;
            }

            // 4. Let n be ? ToInteger(fromIndex).
            //    (If fromIndex is undefined, this step produces the value 0.)
            var n = fromIndex | 0;

            // 5. If n ≥ 0, then
            //  a. Let k be n.
            // 6. Else n < 0,
            //  a. Let k be len + n.
            //  b. If k < 0, let k be 0.
            var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

            function sameValueZero(x, y) {
                return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
            }

            // 7. Repeat, while k < len
            while (k < len) {
                // a. Let elementK be the result of ? Get(O, ! ToString(k)).
                // b. If SameValueZero(searchElement, elementK) is true, return true.
                if (sameValueZero(o[k], searchElement)) {
                    return true;
                }
                // c. Increase k by 1.
                k++;
            }

            // 8. Return false
            return false;
        }
    });
}

if (!Math.trunc) {
    Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;

        return (v - v % 1)   ||   (v < 0 ? -0 : v === 0 ? v : 0);

        // returns:
        //  0        ->  0
        // -0        -> -0
        //  0.2      ->  0
        // -0.2      -> -0
        //  0.7      ->  0
        // -0.7      -> -0
        //  Infinity ->  Infinity
        // -Infinity -> -Infinity
        //  NaN      ->  NaN
        //  null     ->  0
    };
}

// Multiple modals overlay
// https://stackoverflow.com/questions/19305821/multiple-modals-overlay
// Backdrop z-index fix
$(document).on('show.bs.modal', '.modal', function () {
    var zIndex = 1040 + (10 * $('.modal:visible').length);
    $(this).css('z-index', zIndex);
    setTimeout(function() {
        $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
    }, 0);
});
// Scrollbar fix
$(document).on('hidden.bs.modal', '.modal', function () {
    $('.modal:visible').length && $(document.body).addClass('modal-open');
});

function getLocaleDateString(){

    var formats = {
        "ar-SA" : "dd/MM/yy",
        "bg-BG" : "dd.M.yyyy",
        "ca-ES" : "dd/MM/yyyy",
        "zh-TW" : "yyyy/M/d",
        "cs-CZ" : "d.M.yyyy",
        "da-DK" : "dd-MM-yyyy",
        "de-DE" : "dd.MM.yyyy",
        "el-GR" : "d/M/yyyy",
        "en-US" : "M/d/yyyy",
        "fi-FI" : "d.M.yyyy",
        "fr-FR" : "dd/MM/yyyy",
        "he-IL" : "dd/MM/yyyy",
        "hu-HU" : "yyyy. MM. dd.",
        "is-IS" : "d.M.yyyy",
        "it-IT" : "dd/MM/yyyy",
        "ja-JP" : "yyyy/MM/dd",
        "ko-KR" : "yyyy-MM-dd",
        "nl-NL" : "d-M-yyyy",
        "nb-NO" : "dd.MM.yyyy",
        "pl-PL" : "yyyy-MM-dd",
        "pt-BR" : "d/M/yyyy",
        "ro-RO" : "dd.MM.yyyy",
        "ru-RU" : "dd.MM.yyyy",
        "hr-HR" : "d.M.yyyy",
        "sk-SK" : "d. M. yyyy",
        "sq-AL" : "yyyy-MM-dd",
        "sv-SE" : "yyyy-MM-dd",
        "th-TH" : "d/M/yyyy",
        "tr-TR" : "dd.MM.yyyy",
        "ur-PK" : "dd/MM/yyyy",
        "id-ID" : "dd/MM/yyyy",
        "uk-UA" : "dd.MM.yyyy",
        "be-BY" : "dd.MM.yyyy",
        "sl-SI" : "d.M.yyyy",
        "et-EE" : "d.MM.yyyy",
        "lv-LV" : "yyyy.MM.dd.",
        "lt-LT" : "yyyy.MM.dd",
        "fa-IR" : "MM/dd/yyyy",
        "vi-VN" : "dd/MM/yyyy",
        "hy-AM" : "dd.MM.yyyy",
        "az-Latn-AZ" : "dd.MM.yyyy",
        "eu-ES" : "yyyy/MM/dd",
        "mk-MK" : "dd.MM.yyyy",
        "af-ZA" : "yyyy/MM/dd",
        "ka-GE" : "dd.MM.yyyy",
        "fo-FO" : "dd-MM-yyyy",
        "hi-IN" : "dd-MM-yyyy",
        "ms-MY" : "dd/MM/yyyy",
        "kk-KZ" : "dd.MM.yyyy",
        "ky-KG" : "dd.MM.yy",
        "sw-KE" : "M/d/yyyy",
        "uz-Latn-UZ" : "dd/MM yyyy",
        "tt-RU" : "dd.MM.yyyy",
        "pa-IN" : "dd-MM-yy",
        "gu-IN" : "dd-MM-yy",
        "ta-IN" : "dd-MM-yyyy",
        "te-IN" : "dd-MM-yy",
        "kn-IN" : "dd-MM-yy",
        "mr-IN" : "dd-MM-yyyy",
        "sa-IN" : "dd-MM-yyyy",
        "mn-MN" : "yy.MM.dd",
        "gl-ES" : "dd/MM/yy",
        "kok-IN" : "dd-MM-yyyy",
        "syr-SY" : "dd/MM/yyyy",
        "dv-MV" : "dd/MM/yy",
        "ar-IQ" : "dd/MM/yyyy",
        "zh-CN" : "yyyy/M/d",
        "de-CH" : "dd.MM.yyyy",
        "en-GB" : "dd/MM/yyyy",
        "es-MX" : "dd/MM/yyyy",
        "fr-BE" : "d/MM/yyyy",
        "it-CH" : "dd.MM.yyyy",
        "nl-BE" : "d/MM/yyyy",
        "nn-NO" : "dd.MM.yyyy",
        "pt-PT" : "dd-MM-yyyy",
        "sr-Latn-CS" : "d.M.yyyy",
        "sv-FI" : "d.M.yyyy",
        "az-Cyrl-AZ" : "dd.MM.yyyy",
        "ms-BN" : "dd/MM/yyyy",
        "uz-Cyrl-UZ" : "dd.MM.yyyy",
        "ar-EG" : "dd/MM/yyyy",
        "zh-HK" : "d/M/yyyy",
        "de-AT" : "dd.MM.yyyy",
        "en-AU" : "d/MM/yyyy",
        "es-ES" : "dd/MM/yyyy",
        "fr-CA" : "yyyy-MM-dd",
        "sr-Cyrl-CS" : "d.M.yyyy",
        "ar-LY" : "dd/MM/yyyy",
        "zh-SG" : "d/M/yyyy",
        "de-LU" : "dd.MM.yyyy",
        "en-CA" : "dd/MM/yyyy",
        "es-GT" : "dd/MM/yyyy",
        "fr-CH" : "dd.MM.yyyy",
        "ar-DZ" : "dd-MM-yyyy",
        "zh-MO" : "d/M/yyyy",
        "de-LI" : "dd.MM.yyyy",
        "en-NZ" : "d/MM/yyyy",
        "es-CR" : "dd/MM/yyyy",
        "fr-LU" : "dd/MM/yyyy",
        "ar-MA" : "dd-MM-yyyy",
        "en-IE" : "dd/MM/yyyy",
        "es-PA" : "MM/dd/yyyy",
        "fr-MC" : "dd/MM/yyyy",
        "ar-TN" : "dd-MM-yyyy",
        "en-ZA" : "yyyy/MM/dd",
        "es-DO" : "dd/MM/yyyy",
        "ar-OM" : "dd/MM/yyyy",
        "en-JM" : "dd/MM/yyyy",
        "es-VE" : "dd/MM/yyyy",
        "ar-YE" : "dd/MM/yyyy",
        "en-029" : "MM/dd/yyyy",
        "es-CO" : "dd/MM/yyyy",
        "ar-SY" : "dd/MM/yyyy",
        "en-BZ" : "dd/MM/yyyy",
        "es-PE" : "dd/MM/yyyy",
        "ar-JO" : "dd/MM/yyyy",
        "en-TT" : "dd/MM/yyyy",
        "es-AR" : "dd/MM/yyyy",
        "ar-LB" : "dd/MM/yyyy",
        "en-ZW" : "M/d/yyyy",
        "es-EC" : "dd/MM/yyyy",
        "ar-KW" : "dd/MM/yyyy",
        "en-PH" : "M/d/yyyy",
        "es-CL" : "dd-MM-yyyy",
        "ar-AE" : "dd/MM/yyyy",
        "es-UY" : "dd/MM/yyyy",
        "ar-BH" : "dd/MM/yyyy",
        "es-PY" : "dd/MM/yyyy",
        "ar-QA" : "dd/MM/yyyy",
        "es-BO" : "dd/MM/yyyy",
        "es-SV" : "dd/MM/yyyy",
        "es-HN" : "dd/MM/yyyy",
        "es-NI" : "dd/MM/yyyy",
        "es-PR" : "dd/MM/yyyy",
        "am-ET" : "d/M/yyyy",
        "tzm-Latn-DZ" : "dd-MM-yyyy",
        "iu-Latn-CA" : "d/MM/yyyy",
        "sma-NO" : "dd.MM.yyyy",
        "mn-Mong-CN" : "yyyy/M/d",
        "gd-GB" : "dd/MM/yyyy",
        "en-MY" : "d/M/yyyy",
        "prs-AF" : "dd/MM/yy",
        "bn-BD" : "dd-MM-yy",
        "wo-SN" : "dd/MM/yyyy",
        "rw-RW" : "M/d/yyyy",
        "qut-GT" : "dd/MM/yyyy",
        "sah-RU" : "MM.dd.yyyy",
        "gsw-FR" : "dd/MM/yyyy",
        "co-FR" : "dd/MM/yyyy",
        "oc-FR" : "dd/MM/yyyy",
        "mi-NZ" : "dd/MM/yyyy",
        "ga-IE" : "dd/MM/yyyy",
        "se-SE" : "yyyy-MM-dd",
        "br-FR" : "dd/MM/yyyy",
        "smn-FI" : "d.M.yyyy",
        "moh-CA" : "M/d/yyyy",
        "arn-CL" : "dd-MM-yyyy",
        "ii-CN" : "yyyy/M/d",
        "dsb-DE" : "d. M. yyyy",
        "ig-NG" : "d/M/yyyy",
        "kl-GL" : "dd-MM-yyyy",
        "lb-LU" : "dd/MM/yyyy",
        "ba-RU" : "dd.MM.yy",
        "nso-ZA" : "yyyy/MM/dd",
        "quz-BO" : "dd/MM/yyyy",
        "yo-NG" : "d/M/yyyy",
        "ha-Latn-NG" : "d/M/yyyy",
        "fil-PH" : "M/d/yyyy",
        "ps-AF" : "dd/MM/yy",
        "fy-NL" : "d-M-yyyy",
        "ne-NP" : "M/d/yyyy",
        "se-NO" : "dd.MM.yyyy",
        "iu-Cans-CA" : "d/M/yyyy",
        "sr-Latn-RS" : "d.M.yyyy",
        "si-LK" : "yyyy-MM-dd",
        "sr-Cyrl-RS" : "d.M.yyyy",
        "lo-LA" : "dd/MM/yyyy",
        "km-KH" : "yyyy-MM-dd",
        "cy-GB" : "dd/MM/yyyy",
        "bo-CN" : "yyyy/M/d",
        "sms-FI" : "d.M.yyyy",
        "as-IN" : "dd-MM-yyyy",
        "ml-IN" : "dd-MM-yy",
        "en-IN" : "dd-MM-yyyy",
        "or-IN" : "dd-MM-yy",
        "bn-IN" : "dd-MM-yy",
        "tk-TM" : "dd.MM.yy",
        "bs-Latn-BA" : "d.M.yyyy",
        "mt-MT" : "dd/MM/yyyy",
        "sr-Cyrl-ME" : "d.M.yyyy",
        "se-FI" : "d.M.yyyy",
        "zu-ZA" : "yyyy/MM/dd",
        "xh-ZA" : "yyyy/MM/dd",
        "tn-ZA" : "yyyy/MM/dd",
        "hsb-DE" : "d. M. yyyy",
        "bs-Cyrl-BA" : "d.M.yyyy",
        "tg-Cyrl-TJ" : "dd.MM.yy",
        "sr-Latn-BA" : "d.M.yyyy",
        "smj-NO" : "dd.MM.yyyy",
        "rm-CH" : "dd/MM/yyyy",
        "smj-SE" : "yyyy-MM-dd",
        "quz-EC" : "dd/MM/yyyy",
        "quz-PE" : "dd/MM/yyyy",
        "hr-BA" : "d.M.yyyy.",
        "sr-Latn-ME" : "d.M.yyyy",
        "sma-SE" : "yyyy-MM-dd",
        "en-SG" : "d/M/yyyy",
        "ug-CN" : "yyyy-M-d",
        "sr-Cyrl-BA" : "d.M.yyyy",
        "es-US" : "M/d/yyyy"
    };

    return formats[navigator.language] || 'dd/MM/yyyy';
}

function filterObject(obj, key) {
    for (var i in obj) {
        if (!obj.hasOwnProperty(i)) continue;
        if (typeof obj[i] == 'object') {
            filterObject(obj[i], key);
        } else if (i == key) {
            delete obj[key];
        }
    }
    return obj;
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}