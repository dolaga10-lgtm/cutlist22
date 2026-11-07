paypal.Buttons({
    createSubscription: function(data, actions) {
        try {
            var appElement = document.querySelector('[ng-app=app]');
            var $scope = angular.element(appElement).scope();
            $scope = $scope.$$childHead;
            if (!!$scope.clientInfo.email) {
                console.info("Creating PayPal subscription flow...");

                const planIdsEur = ["SPARE", "P-0RU66833MF481403XLZGBZBQ", "P-87209795HX795560YLZGBUBI"];
                const planIdsUsd = ["SPARE", "P-41K92091S8383132KLZMEI3I", "P-20E76556CB6544239LZMEIGY"];
                const planIdsUsdYr = ["SPARE", "P-86793237L1181471VMCMDIYI", "P-0040562664727862KMCMDJXQ"];
                const planIdsEurYr = ["SPARE", "P-3M1617981U325414UMCMCYIQ", "P-7V573910UP619293WMCMDJNA"];

                var planIds = planIdsUsd;

                if ($scope.clientInfo.isEuCountry()) {
                    if ($scope.subscriptionService.isCycleYear) {
                        planIds = planIdsEurYr;
                    } else {
                        planIds = planIdsEur;
                    }
                } else {
                    if ($scope.subscriptionService.isCycleYear) {
                        planIds = planIdsUsdYr;
                    } else {
                        planIds = planIdsUsd;
                    }
                }

                $scope.subscriptionService.selectedPlanId = planIds[$scope.subscriptionService.plan - 1];
                $scope.isBlocked = true;
                $('#subscriptionModal').modal('hide');
                return actions.subscription.create({
                    'plan_id': $scope.subscriptionService.selectedPlanId,
                    'custom_id': $scope.clientInfo.email
                });
            } else {
                $('#subscriptionModal').modal('hide');
                console.error("Tried to create PayPal subscription flow without knowing the user email");
            }
        } catch (e) {
            $scope.isBlocked = true;
            console.error("Error creating PayPal subscription flow\n" + e.stack);
        }
    },
    onApprove: function(data, actions) {
        try {
            var appElement = document.querySelector('[ng-app=app]');
            var $scope = angular.element(appElement).scope();
            $scope = $scope.$$childHead;
            $scope.$apply(function () {
                console.info("Received PayPal subscription order approval: " + JSON.stringify(data));
                $scope.setToFull();
                $scope.subscriptionService.registerSubscription(data).then(function () {
                    $scope.window.location.href = "?action=subscriptionActivated";
                });
            });
        } catch (e) {
            console.error("Error processing PayPal subscription order approval\n" + e.stack);
        }
    },
    onError: function(err) {
        console.error(err);
    },
    onCancel: function (data) {
        var appElement = document.querySelector('[ng-app=app]');
        var $scope = angular.element(appElement).scope();
        $scope = $scope.$$childHead;
        $scope.isBlocked = false;
    }
}).render('#paypal-plan-container');

paypal.Buttons({
    style: {
        shape: 'rect',
        color: 'gold',
        layout: 'vertical',
        label: 'paypal',
    },
    createOrder: function(data, actions) {
        try {
            var appElement = document.querySelector('[ng-app=app]');
            var $scope = angular.element(appElement).scope();
            $scope = $scope.$$childHead;

            $scope.permitPeriodOrderId = uuidv4();

            if (!!$scope.clientInfo.email) {
                $('#subscriptionModal').modal('hide');
                console.info("Creating PayPal permit period order flow...");

                const amount = {"currency_code": null, "value": null};

                if (!$scope.clientInfo.isEuCountry()) {
                    amount.value = 4.9;
                    amount.currency_code = "USD";
                } else {
                    amount.value = 4.9;
                    amount.currency_code = "EUR";
                }

                $scope.isBlocked = true;
                $('#subscriptionModal').modal('hide');

                return actions.order.create({
                    purchase_units: [{
                        "custom_id": $scope.clientInfo.email,
                        "invoice_id": $scope.permitPeriodOrderId,
                        "description": "CutList Optimizer",
                        "amount": amount}]
                });
            } else {
                $('#subscriptionModal').modal('hide');
                console.error("Tried to create PayPal permit period order flow without knowing the user email");
            }
        } catch (e) {
            $scope.isBlocked = false;
            console.error("Error creating PayPal subscription flow\n" + e.stack);
        }
    },
    onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
            try {
                var appElement = document.querySelector('[ng-app=app]');
                var $scope = angular.element(appElement).scope();
                $scope = $scope.$$childHead;
                $scope.$apply(function () {
                    console.info("Received permit period PayPal order approval: " + JSON.stringify(data));
                    $scope.setToFull();
                    data.id = $scope.permitPeriodOrderId;
                    $scope.permitPeriodService.registerPermitPeriod(data).then(function () {
                        $scope.window.location.href = "?action=permitPeriodActivated";
                    });
                });
            } catch (e) {
                console.error("Error processing permit period order approval\n" + e.stack);
            }
        });
    },
    onError: function(err) {
        console.error(err);
    },
    onCancel: function (data) {
        var appElement = document.querySelector('[ng-app=app]');
        var $scope = angular.element(appElement).scope();
        $scope = $scope.$$childHead;
        $scope.isBlocked = false;
    }
}).render('#paypal-button-container');