app.service('PanelListService', ['DimensionProcessor', '$translate', 'ClientInfo', '$http', 'CutListCfg', 'AuthService', '$q',
    function(DimensionProcessor, $translate, ClientInfo, $http, CutListCfg, AuthService, $q) {

    var SAVED_PANEL_LIST_PREFIX = "tiles-";
    var self = this;
    this.panelLists = [];

    this.loadSavedPanelLists = function () {
        var deferred = $q.defer();
        self.panelLists.length = 0;
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (typeof key === 'string' && key.startsWith(SAVED_PANEL_LIST_PREFIX)) {
                    try {
                        var item = JSON.parse(localStorage.getItem(key));
                        if (item) {
                            if (!item.name) item.name = self.getPanelListNameFromKey(key);
                            self.panelLists.push(item);
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error("Error loading panel lists from localStorage:", e);
        }
        deferred.resolve({ data: self.panelLists });
        return deferred.promise;
    };

    this.savePanelList = function (name, panelList) {
        var deferred = $q.defer();
        var cleanName = self.getPanelListNameFromKey(name || ("List " + new Date().toJSON().slice(0, 10)));
        var panelListToSave = JSON.parse(JSON.stringify(panelList || []));
        panelListToSave = panelListToSave.filter(function (panel) { return !!panel.width || !!panel.height; });
        panelListToSave.forEach(function (panel) {
            for (var attribute in panel) {
                if (['id', 'width', 'height', 'label', 'count', 'enabled', 'orientation', 'material', 'edge'].indexOf(attribute) === -1) {
                    delete panel[attribute];
                }
            }
        });

        if (localStorage.getItem(SAVED_PANEL_LIST_PREFIX + cleanName) !== null) {
            if (!confirm($translate.instant('OVERWRITE') + "?\n" + cleanName)) {
                deferred.reject();
                return deferred.promise;
            }
        }
        var record = {
            id: cleanName,
            name: cleanName,
            updated: new Date().toISOString(),
            data: panelListToSave
        };
        localStorage.setItem(SAVED_PANEL_LIST_PREFIX + cleanName, JSON.stringify(record));
        self.loadSavedPanelLists();
        deferred.resolve({ data: record });
        return deferred.promise;
    };

    this.deletePanelList = function (panelList) {
        var deferred = $q.defer();
        var cleanName = self.getPanelListNameFromKey(panelList.name);
        localStorage.removeItem(SAVED_PANEL_LIST_PREFIX + cleanName);
        self.loadSavedPanelLists();
        deferred.resolve();
        return deferred.promise;
    };

    this.saveLocalPanelLists2Server = function () {
        var deferred = $q.defer();
        deferred.resolve();
        return deferred.promise;
    };

    this.getPanelListNameFromKey = function (key) {
        return String(key || "").replace(new RegExp("^" + SAVED_PANEL_LIST_PREFIX), '');
    };

    this.savePanelListsToLocalStorage = function() {
        try {
            self.panelLists.forEach(function (panelList) {
                localStorage.setItem(SAVED_PANEL_LIST_PREFIX + panelList.name, JSON.stringify(panelList));
            });
        } catch (e) {}
    };

    self.removeLocalStoragePanelLists = function () {};

    self.loadSavedPanelLists();
}]);
