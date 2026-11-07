/* Routes download() calls to the native Android saver when running inside the app's WebView.
   - ملفات JSON (نسخ العملاء / قاعدة البيانات): بتفتح مدير الملفات عشان تختار مكان الحفظ.
   - باقي الملفات (PDF / صورة / CSV): بتتحفظ مباشرة في مجلد التنزيلات. */
(function () {
    var orig = window.download;
    if (typeof orig !== 'function') return;

    function usePicker(name, mime) {
        return /\.json$/i.test(name || '') || /json/i.test(mime || '');
    }

    window.download = function (data, name, mime) {
        if (window.NativeSaver) {
            try {
                name = name || 'download';
                var picker = usePicker(name, mime);
                if (typeof data === 'string' && data.indexOf('data:') === 0) {
                    (picker ? NativeSaver.pickSaveDataUrl : NativeSaver.saveDataUrl)(data, name, mime || '');
                    return true;
                }
                if (typeof Blob !== 'undefined' && data instanceof Blob) {
                    var r = new FileReader();
                    r.onload = function () {
                        var m = mime || data.type || '';
                        if (picker) NativeSaver.pickSaveDataUrl(String(r.result), name, m);
                        else NativeSaver.saveDataUrl(String(r.result), name, m);
                    };
                    r.readAsDataURL(data);
                    return true;
                }
                if (typeof data === 'string') {
                    if (picker) NativeSaver.pickSaveText(data, name, mime || 'application/json');
                    else NativeSaver.saveText(data, name, mime || 'text/plain');
                    return true;
                }
            } catch (e) { console.error('NativeSaver failed', e); }
        }
        return orig.apply(this, arguments);
    };
})();
