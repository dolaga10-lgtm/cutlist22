app.service('SubscriptionService', ['$http', 'CutListCfg', 'ClientInfo', 'AuthService', '$q', '$window', '$location', '$timeout', 'ConfigurationProperties', 'BillingDetailsService',
    function($http, CutListCfg, ClientInfo, AuthService, $q, $window, $location, $timeout, ConfigurationProperties, BillingDetailsService) {

    const self = this;

    self.plan = null;
    self.selectedPlanId = null;
    self.isRequestInProgress = false;

    this.createStripeCheckoutSession = function(plan) {

        self.isRequestInProgress = true;
        const deferred = $q.defer();

        let stripeMonthPlanIds = stripeMonthPlanIdsLive;
        let stripeYearPlanIds = stripeYearPlanIdsLive;

        try {

            if ($location.search().stripe === 'test') {
                let stripeMonthPlanIds = stripeMonthPlanIdsTest;
                let stripeYearPlanIds = stripeYearPlanIdsTest;
                console.info("Using Strip test mode plan ids");
            }

            let checkoutPlanId = '';

            if (self.isCycleYear) {
                checkoutPlanId = stripeYearPlanIds[plan - 1][ClientInfo.countryIsoCode];
            } else {
                checkoutPlanId = stripeMonthPlanIds[plan - 1][ClientInfo.countryIsoCode];
            }

            if (!checkoutPlanId) {
                if (self.isCycleYear) {
                    checkoutPlanId = stripeYearPlanIds[plan - 1].US;
                } else {
                    checkoutPlanId = stripeMonthPlanIds[plan - 1].US;
                }
            }

            $http({
                url: CutListCfg.localBaseUrl + '/stripe/create-checkout-session',
                method: 'POST',
                data: {
                    priceId: checkoutPlanId,
                    successUrl: CutListCfg.localBaseUrl + '?action=subscriptionActivated',
                    cancelUrl: CutListCfg.localBaseUrl + '?action=upgrade'
                },
                headers: AuthService.getHttpHeaders()
            }).then(function (response) {
                self.isRequestInProgress = false;
                deferred.resolve(response);
            }, function (result) {
                self.isRequestInProgress = false;
                console.error("Error on request to create Stripe checkout session: " + JSON.stringify(result));
                deferred.reject(result);
            });

        } catch (e) {
            console.error("Error creating Stripe checkout session\n" + e.stack);
        }

        return deferred.promise;
    };

    this.createStripePortalSession = function() {
        self.isRequestInProgress = true;
        const deferred = $q.defer();

        $http({
            url: CutListCfg.localBaseUrl + '/stripe/create-portal-session',
            method: 'POST',
            data: {
                returnUrl: CutListCfg.localBaseUrl + '?action=upgrade'
            },
            headers: AuthService.getHttpHeaders()
        }).then(function (response) {
            self.isRequestInProgress = false;
            deferred.resolve(response);
        }, function (result) {
            self.isRequestInProgress = false;
            console.error("Error Creating Stripe portal session: " + JSON.stringify(result));
            deferred.reject(result);
        });

        return deferred.promise;
    }


    this.registerSubscription = function(data) {
        self.isRequestInProgress = true;
        const deferred = $q.defer();
        const subscriptionData = {id: data.subscriptionID, orderId: data.orderID, planId: self.selectedPlanId};

        $http({
            url: CutListCfg.localBaseUrl + '/subscriptions',
            method: 'POST',
            data: subscriptionData,
            headers: AuthService.getHttpHeaders()
        }).then(function (response) {
            try {
                BillingDetailsService.postInvoiceCustomerDetail();
            } catch (e) {
                console.error("Error on PayPal subscription post processing:\n" + e.stack);
            }
            self.isRequestInProgress = false;
            deferred.resolve(response);
        }, function (result) {
            self.isRequestInProgress = false;
            console.error("Error registering PayPal subscription: " + JSON.stringify(result));
            deferred.reject(result);
        });

        return deferred.promise;
    };

    this.getSubscription = function() {
        const deferred = $q.defer();

        $http({
            url: CutListCfg.localBaseUrl + '/subscriptions?userId=' + encodeURIComponent(ClientInfo.email),
            method: 'GET',
            headers: AuthService.getHttpHeaders()
        }).then(function (response) {
            if (self.isSubscriptionActive(ClientInfo.subscription) && !self.isSubscriptionActive(response.data)) {
                console.warn("Previous PayPal subscription status was set to active but received response otherwise");
            }
            ClientInfo.setSubscription(response.data);
            if (ClientInfo.hasActiveSubscription()) {
                console.info("Subscription is active: " + JSON.stringify(ClientInfo.subscription));
                if (typeof android !== 'undefined') {
                    android.setSubscriptionPlanLevel(ClientInfo.subscription.planLevel);
                }
            }

            deferred.resolve(response.data);
        }, function (reason) {
            if (reason && reason.status === 404) {
                if (ClientInfo.subscription) {
                    console.warn("Subscription info not found on server but had this on local storage: " + JSON.stringify(ClientInfo.subscription) + "\n" + JSON.stringify(reason));
                }
                ClientInfo.subscription = null;
                $window.localStorage.removeItem("subscription");
            } else {
                console.error("Error while fetching Subscription info. Relying on local storage data: " + JSON.stringify(ClientInfo.subscription) + "\n" + JSON.stringify(reason));
            }
            deferred.reject(reason);
        });

        return deferred.promise;
    };

    this.cancelSubscription = function () {
        self.isRequestInProgress = true;
        const deferred = $q.defer();
        $http({
            url: CutListCfg.localBaseUrl + '/subscriptions/' + ClientInfo.subscription.id,
            method: 'DELETE',
            headers: AuthService.getHttpHeaders()
        }).then(function (response) {
            self.isRequestInProgress = false;
            console.info("Canceled PayPal subscription ["  + ClientInfo.subscription.id + "]");
            self.getSubscription();
            deferred.resolve(response);
        }, function (result) {
            self.isRequestInProgress = false;
            console.error("Error cancelling PayPal subscription: " + JSON.stringify(result));
            deferred.reject(result);
        });
        return deferred.promise;
    }

    this.isSubscriptionActive = function(subscription) {
        try {
            return true;
        } catch (e) {
            console.error("Error evaluating subscription status: " + e.stack);
            return true;
        }
    };

    this.getSubscriptionPlanLevelName = function() {
        switch (ClientInfo.subscription && ClientInfo.subscription.planLevel) {
            case 0:
                return "Pro Local";
            case 1:
                return "Bronze";
            case 2:
                return "Silver";
            case 3:
                return "Gold";
            default:
                return null;
        }
    };

    this.getActiveSubscriptionPlanLevel = function() {
        if (!ClientInfo.subscription || !ClientInfo.subscription.planLevel) {
            return 0;
        } else {
            return ClientInfo.subscription.planLevel;
        }
    };

    this.getExecutionThreshold = function () {
        switch (self.getActiveSubscriptionPlanLevel()) {
            case 0:
                return ConfigurationProperties.execThreshold1;
            default:
                return null;
        }
    };

    this.isActiveCycleYear = function () {
        return !!ClientInfo.subscription && ClientInfo.subscription.cycle === 'YEAR';
    };

    function fetchPrices(countryIsoCode) {
        const deferred = $q.defer();
        $http({
            method: "GET",
            url: CutListCfg.localBaseUrl + '/prices/' + countryIsoCode,
            headers: AuthService.getHttpHeaders()
        }).then(function (response) {
            self.prices = response.data;
            deferred.resolve(response);
        }, function (reason) {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    function initPrices(depth) {

        if (!ClientInfo.countryIsoCode && depth < 5) {
            console.info("No country iso code available, delaying price data fetching...");
            $timeout(function () {
                initPrices(depth + 1);
            }, 2000);
            return;
        }

        let countryIsoCode = ClientInfo.countryIsoCode;

        if (!countryIsoCode) {
            countryIsoCode = 'us';
            console.warn('Assuming country iso code as [' + countryIsoCode + ']');
        }

        fetchPrices(countryIsoCode).then(function (response) {
            self.prices = response.data;
            console.info("Fetched price data for countryIsoCode[" + countryIsoCode + "]");
        }, function (reason) {
            if (reason.status === 404) {
                console.info("Price data not available for countryIsoCode[" + countryIsoCode + "]");
                if (ClientInfo.isEuCountry()) {
                    countryIsoCode = 'pt';
                } else {
                    countryIsoCode = 'us';
                }
                fetchPrices(countryIsoCode).then(function () {
                    console.info("Alternatively fetched price data for countryIsoCode[" + countryIsoCode + "]");
                });
            } else {
                console.error("Error while fetching price data for countryIsoCode[" + countryIsoCode + "]\n" + JSON.stringify(reason));
            }
        });
    }

    // initPrices disabled for local mode

}]);
