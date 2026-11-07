app.controller('SubscriptionController', ['$scope', '$window', 'SubscriptionService', '$translate', 'ClientInfo', 'AuthService', 'ToastService', 'BillingDetailsService',
    function($scope, $window, SubscriptionService, $translate, ClientInfo, AuthService, ToastService, BillingDetailsService) {

    $scope.activeSection = 0;
    $scope.message = {};

    $scope.billingDetailsService = BillingDetailsService;

    $scope.cancelSubscription = function () {
        if (confirm($translate.instant('CANCEL_SUBSCRIPTION') + '\n' + $scope.getCancelInfoText())) {
            SubscriptionService.cancelSubscription().then(function () {
                SubscriptionService.getSubscription().finally( function () {
                    ToastService.info($translate.instant('SUBSCRIPTION_CANCELED'));
                });
            }, function (reason) {
                $scope.message.data = $translate.instant('SUBSCRIPTION_CANCEL_ERROR');
            });
        }
    }

    function getActiveUntilFormattedExpirationDate() {
        if (!ClientInfo.subscription || !ClientInfo.subscription.lastPaymentDate) {
            return null;
        }
        var lastPaymentDate = new Date(ClientInfo.subscription.lastPaymentDate);

        switch (ClientInfo.subscription.cycle) {
            case "MONTH":
                return $scope.formatDate(new Date(lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1)));
                break;
            case "YEAR":
                return $scope.formatDate(new Date(lastPaymentDate.setFullYear(lastPaymentDate.getFullYear() + 1)));
                break;
            default:
                console.error("Unknown billing cycle: " + ClientInfo.subscription.cycle);
                return null;
        }
    }

    $scope.getPlanLabel = function () {

        if (!ClientInfo.subscription) {
            return '';
        }

        var planLabel = SubscriptionService.getSubscriptionPlanLevelName();
        var activeUntilFormatedExpirationDate = getActiveUntilFormattedExpirationDate();
                
        if (!ClientInfo.subscription.nextPaymentDate && activeUntilFormatedExpirationDate) {
            planLabel += ' (active until ' + activeUntilFormatedExpirationDate + ')';
        }
        
        return planLabel;
    }

    $scope.getCancelInfoText = function () {
        var activeUntilDate = getActiveUntilFormattedExpirationDate();
        if (!!activeUntilDate) {
            return 'If canceled, plan will remain active until ' + activeUntilDate + '.';
        }
        return '';
    }

    $scope.onPlanChoice = function(plan) {

        if (typeof android !== 'undefined') {

            if (!$scope.validateLogin()) {
                return;
            }

            android.setUserAccessToken(ClientInfo.accessToken);
            android.onPlanChoice(plan);
            return;
        }

        if (ClientInfo.countryIsoCode && ClientInfo.countryIsoCode.toUpperCase() === 'IN'
            || ClientInfo.countryIsoCode && ClientInfo.countryIsoCode.toUpperCase() === 'IR'
            || ClientInfo.countryIsoCode && ClientInfo.countryIsoCode.toUpperCase() === 'TR'    // Turkey
            || ClientInfo.countryIsoCode && ClientInfo.countryIsoCode.toUpperCase() === 'CN'    // China
        ) {

            console.info("Creating Stripe checkout session... countryIsoCode[" + ClientInfo.countryIsoCode.toUpperCase() + "] plan[" + plan + "]");

            $scope.subscriptionService.createStripeCheckoutSession(plan).then(function (response) {
                $window.location.href = response.data.url;
            }, function (result) {
                $scope.message.data = $translate.instant('GENERIC_ERROR_MSG');
            });

        } else {
            $scope.subscriptionService.plan = plan;
        }
    }

    $scope.getPrice = function (plan) {

        if (!SubscriptionService.prices) {
            return null;
        }

        if (SubscriptionService.isCycleYear || SubscriptionService.isActiveCycleYear()) {
            value = SubscriptionService.prices.year[plan].value / 12;
            format = SubscriptionService.prices.year[plan].format;
        } else {
            value = SubscriptionService.prices.month[plan].value;
            format = SubscriptionService.prices.month[plan].format;
        }

        return format.replace('{price}', value);
    }

    $scope.createStripePortalSession = function () {
        $scope.subscriptionService.createStripePortalSession().then(function (response) {
            $window.location.href = response.data.url;
        }, function (result) {
            $scope.message.data = $translate.instant('GENERIC_ERROR_MSG');
        });
    }
}]);
