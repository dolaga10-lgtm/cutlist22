app.config(function(toastrConfig) {
    angular.extend(toastrConfig, {
        autoDismiss: true,
        containerId: 'toast-container',
        maxOpened: 1,
        newestOnTop: false,
        positionClass: 'toast-top-right',
        preventDuplicates: false,
        preventOpenDuplicates: false,
        target: 'body',
        timeOut: 4000,
        tapToDismiss: true,
        allowHtml: true
    });
});

app.service('ToastService', ['toastr', '$timeout', '$window', 'toastrConfig',
    function(toastr, $timeout, $window, toastrConfig) {

    var self = this;

    var isFadingOut = false;
    var isVisible = false;

    var isAndroid = typeof android !== 'undefined';

    function info(msg) {
        if (isAndroid) {
            android.showToast(msg);
        } else {

            if ($window.innerWidth >= 768) {
                angular.extend(toastrConfig, { positionClass: "toast-top-right" });
            } else {
                angular.extend(toastrConfig, { positionClass: "toast-bottom-full-width" });
            }

            toastr.info(msg, {
                onShown: function () {
                    self.isFadingOut = false;
                    self.isVisible = true;
                },
                onHidden: function () {
                    self.isFadingOut = true;
                    // Wait for fade out to finish and ensure toast was not redrawn
                    $timeout(function() {
                        if (self.isFadingOut) {
                            self.isVisible = false;
                        }
                    }, 500);
                }
            });
        }
    }

    function success(msg) {
        if (isAndroid) {
            android.showToast(msg);
        } else {

            if ($window.innerWidth >= 768) {
                angular.extend(toastrConfig, { positionClass: "toast-top-right" });
            } else {
                angular.extend(toastrConfig, { positionClass: "toast-bottom-full-width" });
            }

            toastr.success(msg, {
                positionClass: "toast-bottom-full-width",
                onShown: function () {
                    self.isFadingOut = false;
                    self.isVisible = true;
                },
                onHidden: function () {
                    self.isFadingOut = true;
                    // Wait for fade out to finish and ensure toast was not redrawn
                    $timeout(function() {
                        if (self.isFadingOut) {
                            self.isVisible = false;
                        }
                    }, 500);
                }
            });
        }
    }

    function warning(msg) {
        if (isAndroid) {
            android.showToast(msg);
        } else {

            if ($window.innerWidth >= 768) {
                angular.extend(toastrConfig, { positionClass: "toast-top-right" });
            } else {
                angular.extend(toastrConfig, { positionClass: "toast-bottom-full-width" });
            }

            toastr.warning(msg, {
                onShown: function () {
                    self.isFadingOut = false;
                    self.isVisible = true;
                },
                onHidden: function () {
                    self.isFadingOut = true;
                    // Wait for fade out to finish and ensure toast was not redrawn
                    $timeout(function() {
                        if (self.isFadingOut) {
                            self.isVisible = false;
                        }
                    }, 500);
                }
            });
        }
    }

    function error(msg) {
        if (isAndroid) {
            android.showToast(msg);
        } else {

            if ($window.innerWidth >= 768) {
                angular.extend(toastrConfig, { positionClass: "toast-top-right" });
            } else {
                angular.extend(toastrConfig, { positionClass: "toast-bottom-full-width" });
            }

            toastr.error(msg, {
                onShown: function () {
                    self.isVisible = true;
                },
                onHidden: function () {
                    self.isFadingOut = true;
                    // Wait for fade out to finish and ensure toast was not redrawn
                    $timeout(function() {
                        if (self.isFadingOut) {
                            self.isVisible = false;
                        }
                    }, 500);
                }
            });
        }
    }

    return {
        info: info,
        success: success,
        warning: warning,
        error: error,
        isVisible: function() {
            return self.isVisible;
        },
        clearAll: function  () {
            toastr.clear();
        }
    }
}]);
