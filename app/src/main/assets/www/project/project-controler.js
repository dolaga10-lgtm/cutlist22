app.controller('ProjectControler', ['$scope', '$http', 'CutListCfg', '$httpParamSerializerJQLike', 'ToastService', 'ProjectService', '$translate', 'TilingData', 'ClientInfo', 'AuthService', '$timeout', 'MouseTracker', 'DimensionProcessor', '$filter', '$window',
    function($scope, $http, CutListCfg, $httpParamSerializerJQLike, ToastService, ProjectService, $translate, TilingData, ClientInfo, AuthService, $timeout, MouseTracker, DimensionProcessor, $filter, $window) {

    $scope.projectService = ProjectService;
    $scope.isLoading = false;
    $scope.message = null;
    $scope.clientMeta = {
        clientName: "",
        clientPhone: "",
        notes: ""
    };
    // على الموبايل: بعد الحفظ المحلي افتح مدير الملفات عشان تختار مكان نسخة الملف
    $scope.saveOptions = { exportCopy: (typeof window.NativeSaver !== 'undefined') };

    $scope.clearContextMenu = function() {
        if ($scope.gridApi && $scope.gridApi.core) {
            var filteredRows = $scope.gridApi.core.getVisibleRows($scope.gridApi.grid);
            filteredRows.forEach(function (element) {
                element.entity.$$menu = false;
            });
        }
        if (!!$scope.projectBeingRenamed) {
            $scope.renameProject($scope.projectBeingRenamed);
            $scope.projectBeingRenamed = null;
        }
    };

    $scope.toggleRename = function (row, $event) {
        $scope.projectBeingRenamed = row.entity;
        row.entity.$$oldName = row.entity.name;
        row.entity.$$newName = row.entity.name;
        row.entity.$$isBeingRenamed = true;
        row.entity.$$menu = false;
        $timeout(function () {
            var input = document.getElementById('new-name-' + row.entity.id);
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
        if ($event) $event.stopPropagation();
    };

    $scope.refreshFilter = function() {
        if (!$scope.searchQuery) {
            $scope.projectsGridOptions.data = ProjectService.projects;
            return;
        }
        var q = $scope.searchQuery.toLowerCase();
        var filteredProjects = ProjectService.projects.filter(function (project) {
            var createdLoacaleFormattedDate = $filter('date')(project.created, getLocaleDateString());
            var updatedFormattedDate = $filter('date')(project.updated, getLocaleDateString());
            return (project.name && project.name.toLowerCase().includes(q)) ||
                (project.clientName && project.clientName.toLowerCase().includes(q)) ||
                (project.clientPhone && project.clientPhone.toLowerCase().includes(q)) ||
                (project.notes && project.notes.toLowerCase().includes(q)) ||
                (createdLoacaleFormattedDate && createdLoacaleFormattedDate.toLowerCase().includes(q)) ||
                (updatedFormattedDate && updatedFormattedDate.toLowerCase().includes(q));
        });
        $scope.projectsGridOptions.data = filteredProjects;
    };

    $scope.cellClicked = function (row, $event) {
        var menuEl = document.getElementById('row-menu-' + row.entity.id);
        if (menuEl) {
            document.body.appendChild(menuEl);
            menuEl.style.left = Math.min(window.innerWidth - 160, Math.max(10, MouseTracker.getMouseX())) + 'px';
            menuEl.style.top = Math.min(window.innerHeight - 120, Math.max(10, MouseTracker.getMouseY())) + 'px';
        }
        if (row.entity.$$menu) {
            row.entity.$$menu = false;
        } else {
            $scope.clearContextMenu();
            row.entity.$$menu = true;
        }
        if ($event) $event.stopPropagation();
    };

    $scope.rowClick = function (row) {
        if (!!$scope.projectBeingRenamed) {
            return;
        }
        if ($scope.$parent.confirmUnsavedChanges()) {
            $scope.loadSavedProject(row.entity.id || row.entity.name);
        }
    };

    $scope.projectsGridOptions = {
        enableColumnResizing: true,
        enableSorting: true,
        enableColumnMenus: false,
        enableHorizontalScrollbar: false,
        enableVerticalScrollbar: true,
        enableGridMenu: false,
        paginationPageSizes: [20, 50, 100],
        paginationPageSize: 20,
        columnDefs: [],
        onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            if ($scope.gridApi.colResizable) {
                $scope.gridApi.colResizable.on.columnSizeChanged($scope, saveState);
            }
            $scope.gridApi.core.on.columnVisibilityChanged($scope, saveState);
            $scope.gridApi.core.on.filterChanged($scope, saveState);
            $scope.gridApi.core.on.sortChanged($scope, saveState);
            if (!!$scope.gridApi.pagination) {
                $scope.gridApi.pagination.on.paginationChanged($scope, saveState);
            }
            restoreState();
        }
    };

    function setupProjectsGridOptions() {
        $scope.projectsGridOptions.columnDefs.length = 0;
        if (!$scope.isMobile) {
            $scope.projectsGridOptions.columnDefs.push(
                { name: 'name', displayName: 'Project / Client Name', width: '50%', enableCellEdit: true, cellTemplate: 'project/name-cell-template.html' },
                { field: 'created', displayName: 'Creation Date', type: 'date', cellFilter: 'date:\'' + getLocaleDateString() + '\'', width: '20%' },
                { field: 'updated', displayName: 'Last Modified', type: 'date', cellFilter: 'date:\'' + getLocaleDateString() + '\'', width: '20%',
                    cellTemplate: '<div class="ui-grid-cell-contents">' +
                        '<span ng-if="row.entity.updated !== null">{{grid.appScope.formatDate(row.entity.updated)}}</span>' +
                        '<span style="color: darkgrey" ng-if="row.entity.updated === null">{{grid.appScope.formatDate(row.entity.created)}}</span>' +
                        '</div>'},
                { name: 'actions', displayName: '', width: '10%', cellTemplate: 'project/row-actions.html', enableFiltering: false, enableSorting: false }
            );
        } else {
            $scope.projectsGridOptions.columnDefs.push(
                { name: 'name', displayName: 'Project / Client Name', width: '60%', enableCellEdit: true, cellTemplate: 'project/name-cell-template.html' },
                { field: 'updated', displayName: 'Last Modified', type: 'date', cellFilter: 'date:\'' + getLocaleDateString() + '\'', width: '30%',
                    cellTemplate: '<div class="ui-grid-cell-contents">' +
                        '<span ng-if="row.entity.updated !== null">{{grid.appScope.formatDate(row.entity.updated)}}</span>' +
                        '<span style="color: darkgrey" ng-if="row.entity.updated === null">{{grid.appScope.formatDate(row.entity.created)}}</span>' +
                        '</div>'},
                { name: 'actions', displayName: '', width: '10%', cellTemplate: 'project/row-actions.html', enableFiltering: false, enableSorting: false }
            );
        }
    }

    setupProjectsGridOptions();

    function saveState() {
        try {
            if ($scope.gridApi && $scope.gridApi.saveState) {
                var state = $scope.gridApi.saveState.save();
                $window.localStorage.setItem("projectsGridState", JSON.stringify(state));
            }
        } catch (e) {}
    }

    function restoreState() {
        try {
            $timeout(function() {
                var state = JSON.parse($window.localStorage.getItem("projectsGridState"));
                if (state && $scope.gridApi && $scope.gridApi.saveState) {
                    $scope.gridApi.saveState.restore($scope, state);
                }
            });
        } catch (e) {}
    }

    $scope.projectsGridOptions.data = ProjectService.projects;

    $scope.selectExistingProjectToSave = function (proj) {
        $scope.projectToSaveKey = proj.name;
        $scope.clientMeta.clientName = proj.clientName || "";
        $scope.clientMeta.clientPhone = proj.clientPhone || "";
        $scope.clientMeta.notes = proj.notes || "";
    };

    $scope.saveProject = function () {
        try {
            if (!$scope.projectToSaveKey || !$scope.projectToSaveKey.trim()) {
                $scope.projectToSaveKey = "Project " + new Date().toJSON().slice(0, 10);
            }
            $scope.isLoading = true;
            ProjectService.saveProject(
                $scope.$parent.currentProject ? $scope.$parent.currentProject.id : null,
                $scope.projectToSaveKey.trim(),
                $scope.tiles,
                $scope.stockTiles,
                $scope.cfg,
                $scope.clientMeta
            ).then(function (response) {
                $scope.$parent.currentProject.id = response.data.id;
                $scope.$parent.currentProject.name = response.data.name;
                $scope.$parent.currentProject.clientName = $scope.clientMeta.clientName;
                $scope.$parent.currentProject.clientPhone = $scope.clientMeta.clientPhone;
                $scope.$parent.currentProject.notes = $scope.clientMeta.notes;
                $scope.$parent.currentProject.isDirty = false;
                ProjectService.loadSavedProjects().finally(function () {
                    $('#saveProjectModal').modal('hide');
                    $scope.message = null;
                    $scope.isLoading = false;
                    ToastService.info($translate.instant('SAVED') + ": " + response.data.name);
                    if ($scope.saveOptions.exportCopy) {
                        try {
                            var json = ProjectService.exportProjectJson(response.data.name);
                            var fname = 'CutList_' + response.data.name + '_' + new Date().toJSON().slice(0, 10) + '.json';
                            download(new Blob([json], { type: 'application/json;charset=utf-8' }), fname, 'application/json');
                        } catch (e) {
                            console.error("Error exporting project copy:", e);
                        }
                    }
                });
            }, function (reason) {
                $scope.isLoading = false;
            });
        } catch (e) {
            $scope.isLoading = false;
            console.error("Error saving project:", e);
        }
    };

    $scope.deleteProject = function (project) {
        try {
            var cleanName = ProjectService.getProjectNameFromKey(project.name);
            if (confirm($translate.instant('REMOVE') + "?\n" + cleanName)) {
                if ($scope.$parent.currentProject && ($scope.$parent.currentProject.id === project.id || $scope.$parent.currentProject.name === cleanName)) {
                    $scope.$parent.currentProject.id = null;
                    $scope.$parent.currentProject.name = null;
                }
                project.$$menu = false;
                ProjectService.deleteProject(project).then(function () {
                    ProjectService.loadSavedProjects();
                    $scope.refreshFilter();
                    $scope.message = null;
                    ToastService.info($translate.instant('DELETED') + ": " + cleanName);
                });
            }
        } catch (e) {
            console.error("Error deleting project:", e);
        }
    };

    $scope.renameProject = function (projectOrId) {
        try {
            var project = typeof projectOrId === 'object' ? projectOrId : ProjectService.projects.find(function(p) { return p.id === projectOrId || p.name === projectOrId; });
            if (!project) return;
            if (!project.$$newName || project.$$newName.trim().length === 0 || project.name === project.$$newName.trim()) {
                project.$$isBeingRenamed = false;
                return;
            }
            var oldName = project.$$oldName || project.name;
            var newName = project.$$newName.trim();
            project.$$isBeingRenamed = false;

            ProjectService.renameProject(project.id || oldName, newName).then(function () {
                project.name = newName;
                project.updated = new Date().toISOString();
                $scope.message = null;
                if ($scope.$parent.currentProject && ($scope.$parent.currentProject.id === project.id || $scope.$parent.currentProject.name === oldName)) {
                    $scope.$parent.currentProject.name = newName;
                }
                ToastService.info($translate.instant('RENAMED') + ": " + newName);
            });
        } catch (e) {
            console.error("Error renaming project:", e);
        }
    };

    $scope.loadSavedProject = function (idOrName) {
        $scope.isLoading = true;
        ProjectService.loadProjectFromServer(idOrName).then(function(response) {
            var project = response.data;
            try {
                var workspace = project.data.workspace || project.data.request || project.data;
                var hasLabels = (workspace.panels || []).filter(function (panel) { return !!panel.label; }).length > 0;
                $scope.cfg.isTileLabelVisible = hasLabels;

                var hasMaterial = (workspace.panels || []).filter(function (panel) { return !!panel.material; }).length > 0;
                $scope.cfg.isMaterialEnabled = hasMaterial;

                var hasEdgeBanding = (workspace.panels || []).filter(function (panel) {
                    return panel.edge && (panel.edge.top || panel.edge.bottom || panel.edge.left || panel.edge.right);
                }).length > 0;
                $scope.cfg.hasEdgeBanding = hasEdgeBanding;

                if (workspace.configuration) {
                    $scope.cfg.cutThickness = parseFloat(workspace.configuration.cutThickness) || 0;
                    $scope.cfg.cutThicknessInput = DimensionProcessor.formatDimension($scope.cfg.cutThickness, false);
                }
            } catch (e) {
                console.error("Error loading project configuration:", e);
            }

            $timeout(function () {
                ProjectService.loadProject(project.data, $scope.tiles, $scope.stockTiles, $scope.cfg).then(function () {
                    $scope.setupUnits();
                    $scope.$parent.validateTilesArray();
                    $scope.$parent.validateStockTilesArray();
                    $scope.$parent.refreshMaterialsList();
                    $scope.$parent.refreshEdgeBandList();
                    $scope.render();
                    $('#loadProjectModal').modal('hide');
                    $scope.message = null;
                    $scope.isLoading = false;
                    ToastService.info($translate.instant('LOADED') + ": " + project.name);
                    $scope.$parent.currentProject.id = project.id || project.name;
                    $scope.$parent.currentProject.name = project.name;
                    $scope.$parent.currentProject.clientName = project.clientName || "";
                    $scope.$parent.currentProject.clientPhone = project.clientPhone || "";
                    $scope.$parent.currentProject.notes = project.notes || "";
                    $timeout(function () {
                        $scope.$parent.currentProject.isDirty = false;
                    }, 500);
                });
            });
        }, function () {
            $scope.isLoading = false;
            ToastService.error($translate.instant('ERROR'));
        });
    };

    $scope.exportLocalDatabase = function () {
        try {
            var jsonStr = ProjectService.exportAllDatabaseJson();
            var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            var filename = 'CutList_Clients_Projects_Backup_' + new Date().toJSON().slice(0, 10) + '.json';
            download(blob, filename, 'application/json');
            ToastService.info("تم تصدير نسخة احتياطية من قاعدة البيانات: " + filename);
        } catch (e) {
            console.error("Error exporting DB:", e);
        }
    };

    $scope.triggerImportLocalDatabase = function () {
        var input = document.getElementById('importLocalDbInput');
        if (input) input.click();
    };

    window.handleLocalDbImportFile = function (inputEl) {
        if (!inputEl.files || !inputEl.files[0]) return;
        var file = inputEl.files[0];
        var reader = new FileReader();
        reader.onload = function (evt) {
            try {
                ProjectService.importDatabaseJson(evt.target.result).then(function () {
                    $scope.$applyAsync(function () {
                        $scope.projectsGridOptions.data = ProjectService.projects;
                        $scope.refreshFilter();
                        ToastService.info("تم استيراد قاعدة بيانات المشروعات والعملاء بنجاح!");
                    });
                });
            } catch (err) {
                ToastService.error("ملف قاعدة البيانات غير صالح");
            }
            inputEl.value = '';
        };
        reader.readAsText(file);
    };

    $("#saveProjectModal").on('shown.bs.modal', function() {
        $timeout(function () {
            ProjectService.loadSavedProjects();
            if ($scope.$parent.currentProject && $scope.$parent.currentProject.name) {
                $scope.projectToSaveKey = $scope.$parent.currentProject.name;
                $scope.clientMeta.clientName = $scope.$parent.currentProject.clientName || "";
                $scope.clientMeta.clientPhone = $scope.$parent.currentProject.clientPhone || "";
                $scope.clientMeta.notes = $scope.$parent.currentProject.notes || "";
            } else {
                $scope.projectToSaveKey = "مشروع جديد " + new Date().toJSON().slice(0, 10);
                $scope.clientMeta = { clientName: "", clientPhone: "", notes: "" };
            }
        });
    });

    $("#loadProjectModal").on('shown.bs.modal', function() {
        $timeout(function () {
            ProjectService.loadSavedProjects().then(function() {
                $scope.projectsGridOptions.data = ProjectService.projects;
                $scope.refreshFilter();
                if ($scope.gridApi && $scope.gridApi.core) {
                    $scope.gridApi.core.handleWindowResize();
                }
            });
        }, 100);
    });
}]);
