/**
 *
 * 2020 Cornelius Kölbel, <cornelius.koelbel@netknights.it>
 *
 * This code is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


myApp.controller("dashboardController", ["ConfigFactory", "TokenFactory",
    "AuditFactory", "MonitoringFactory",
    "$scope", "$location", "AuthFactory",
    function (ConfigFactory, TokenFactory,
        AuditFactory, MonitoringFactory,
        $scope, $location, AuthFactory) {

        $scope.tokens = { "total": 0, "hardware": 0 };
        $scope.policies = {
            "active": [], "num_active": 0,
            "inactive": [], "num_inactive": 0
        };
        $scope.events = {
            "active": [], "num_active": 0,
            "inactive": [], "num_inactive": 0
        };
        $scope.authentications = { "success": 0, "fail": 0 };

        $scope.get_total_token_number = function () {
            // We call getTokens with pagesize=0, so that we do
            // not need any user resolving.
            TokenFactory.getTokensNoCancel(function (data) {
                if (data) {
                    $scope.tokens.total = data.result.value.count;
                }
            }, { "pagesize": 0 });
        };

        $scope.get_token_hardware = function () {
            TokenFactory.getTokensNoCancel(function (data) {
                if (data) {
                    $scope.tokens.hardware = data.result.value.count;
                }
            }, { "pagesize": 0, "infokey": "tokenkind", "infovalue": "hardware" });
            TokenFactory.getTokensNoCancel(function (data) {
                if (data) {
                    $scope.tokens.unassigned_hardware = data.result.value.count;
                }
            }, { "pagesize": 0, "infokey": "tokenkind", "infovalue": "hardware", "assigned": "False" });
        };

        $scope.get_token_software = function () {
            TokenFactory.getTokensNoCancel(function (data) {
                if (data) {
                    $scope.tokens.software = data.result.value.count;
                }
            }, { "pagesize": 0, "infokey": "tokenkind", "infovalue": "software" });
            TokenFactory.getTokensNoCancel(function (data) {
                if (data) {
                    $scope.tokens.unassigned_software = data.result.value.count;
                }
            }, { "pagesize": 0, "infokey": "tokenkind", "infovalue": "software", "assigned": "False" });
        };

        $scope.get_policies = function () {
            ConfigFactory.getPolicies(function (data) {
                $scope.policies = {
                    "active": [], "num_active": 0,
                    "inactive": [], "num_inactive": 0
                };
                var policies = data.result.value;
                angular.forEach(policies, function (policy) {
                    if (policy.active) {
                        $scope.policies.active.push(policy.name);
                        $scope.policies.num_active += 1;
                    } else {
                        $scope.policies.inactive.push(policy.name);
                        $scope.policies.num_inactive += 1;
                    }
                });
            });
        };

        $scope.get_events = function () {
            $scope.events = {
                "active": [], "num_active": 0,
                "inactive": [], "num_inactive": 0
            };
            ConfigFactory.getEvents(function (data) {
                var events = data.result.value;
                angular.forEach(events, function (event) {
                    if (event.active) {
                        $scope.events.active.push(event);
                        $scope.events.num_active += 1;
                    } else {
                        $scope.events.inactive.push(event);
                        $scope.events.num_inactive += 1;
                    }
                });
            });
        };

        $scope.getAuthentication = function () {
            $scope.authentications = { "success": 0, "fail": 0 };
            AuditFactory.get({ "timelimit": "1d", "action": "*validate/*check", "success": "1" },
                function (data) {
                    $scope.authentications.success = data.result.value.count;
                });
            AuditFactory.get({ "timelimit": "1d", "action": "*validate/*check", "success": "0" },
                function (data) {
                    $scope.authentications.fail = data.result.value.count;
                    $scope.authentications.users = {}; // Declare the users object as a dictionary
                    $scope.authentications.serials = Array();
                    angular.forEach(data.result.value.auditdata, function (auditentry) {
                        if (auditentry.user) {
                            // Check if the user already exists in the dictionary
                            if (!$scope.authentications.users[auditentry.user + "-" + auditentry.realm]) {
                                // Add the user to the dictionary with a count of 1 and the latest error date
                                $scope.authentications.users[auditentry.user + "-" + auditentry.realm] = { "user": auditentry.user, "realm": auditentry.realm, "fails": 1, "latestError": auditentry.date };
                            } else {
                                // Increment the number of fails for the existing user and update the latest error date
                                $scope.authentications.users[auditentry.user + "-" + auditentry.realm].fails++;
                                if (auditentry.date > $scope.authentications.users[auditentry.user + "-" + auditentry.realm].latestError) {
                                    $scope.authentications.users[auditentry.user + "-" + auditentry.realm].latestError = auditentry.date;
                                }
                            }
                        } else {
                            $scope.authentications.serials.push(auditentry.serial);
                        }
                    });
                    // Convert the dictionary to an array and sort it by the latest error date
                    $scope.authentications.users = Object.values($scope.authentications.users);
                    $scope.authentications.users.sort(function (a, b) {
                        return b.latestError - a.latestError;
                    });
                });
        };

        $scope.getAdministration = function () {
            $scope.administration = [];
            angular.forEach(["system", "resolver", "realm", "policy", "event"],
                function (adminaction) {
                    AuditFactory.get({ "timelimit": "1d", "action": "POST /" + adminaction + "*" },
                        function (data) {
                            angular.forEach(data.result.value.auditdata, function (auditentry) {
                                $scope.administration.push(auditentry);
                            });
                            // reverse sort it by date
                            $scope.administration.sort($scope.compare_auditentries);
                            // only return the last 5 entries
                            $scope.administration = $scope.administration.slice(0, 5);
                        });
                });
        };

        $scope.compare_auditentries = function (a, b) {
            if (a.date < b.date) return 1;
            if (b.date < a.date) return -1;
            return 0;
        };

        $scope.tokenTimeline = {
            datasets: []
        };

        $scope.timeFrame = [
            { label: "1 Day", unit: "day", amount: 1 },
            { label: "1 Week", unit: "day", amount: 7 },
            { label: "1 Month", unit: "month", amount: 1 },
            { label: "3 Months", unit: "month", amount: 3 },
            { label: "6 Months", unit: "month", amount: 6 },
            { label: "1 Year", unit: "year", amount: 1 },
            { label: "All", unit: "year", amount: 100 }
        ]

        $scope.selectedTimeFrame = $scope.timeFrame[0];
        $scope.selectedStatsKeys = [];
        $scope.availableStatsKeys = [];
        

        $scope.generateRandomColor = function () {
            const chars = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += chars[Math.floor(Math.random() * 16)];
            }
            return color
        }

        $scope.getAvailableStatsKeys = function () {
            $scope.selectedStatsKeys = [];
            $scope.availableStatsKeys = [];
            MonitoringFactory.get_stats_keys(function (data) {
                var newList = [];
                data.result.value.forEach(function (key) {
                    newList.push({
                        id: key,
                        name: key,
                        color: $scope.generateRandomColor(),
                        selected: false
                    });
                });
                $scope.availableStatsKeys = newList;
            });
        };

        $scope.getStartTime = function (selectedTimeFrame) {
            var today = new Date()
            var day = today.getDate()
            var month = today.getMonth()
            var year = today.getFullYear()

            if (selectedTimeFrame.unit === "day") {
                day = day - selectedTimeFrame.amount
            }
            if (selectedTimeFrame.unit === "month") {
                month = month - selectedTimeFrame.amount
            }
            if (selectedTimeFrame.unit === "year") {
                year = year - selectedTimeFrame.amount
            }
            return new Date(year, month, day)
        }

        $scope.changeHidden = function (key) {
            var ds = $scope.tokenTimeline.datasets.find(d => d.label === key.name);
            if (ds) {
                ds.hidden = !ds.hidden;
            }
        }

        $scope.clearTimeLine = function () {
            $scope.tokenTimeline = {
                datasets: []
            };
        }

        $scope.getTokenTimeline = function () {
            $scope.clearTimeLine()
            var newTimeline = []
            var startTime = $scope.getStartTime($scope.selectedTimeFrame)

            $scope.selectedStatsKeys.forEach(sk =>
                MonitoringFactory.get_monitored(sk.name, { start: startTime }, function (data) {
                    var d = data.result.value;
                    var color = sk.color;
                    var dataset = {
                        label: sk.name,
                        data: d.map(e => ({ x: new Date(e[0].replace(" ", "T")), y: e[1] })),
                        borderColor: color,
                        backgroundColor: color,
                        pointBackgroundColor: color,
                        hidden: false
                    }
                    newTimeline.push(dataset)
                }),
            )
            $scope.tokenTimeline.datasets = newTimeline
        };

        if (AuthFactory.checkRight('tokenlist')) {
            $scope.get_total_token_number();
            $scope.get_token_hardware();
            $scope.get_token_software();
        }
        if (AuthFactory.checkRight('policyread')) {
            $scope.get_policies();
        }
        if (AuthFactory.checkRight('eventhandling_read')) {
            $scope.get_events();
        }
        if (AuthFactory.checkRight('auditlog')) {
            $scope.getAuthentication();
            $scope.getAdministration();
        }
        if (AuthFactory.checkRight('statistics_read')) {
            $scope.getAvailableStatsKeys();
        }

        // listen to the reload broadcast
        $scope.$on("piReload", function () {
            if (AuthFactory.checkRight('tokenlist')) {
                $scope.get_total_token_number();
                $scope.get_token_hardware();
                $scope.get_token_software();
            }
            if (AuthFactory.checkRight('policyread')) {
                $scope.get_policies();
            }
            if (AuthFactory.checkRight('eventhandling_read')) {
                $scope.get_events();
            }
            if (AuthFactory.checkRight('auditlog')) {
                $scope.getAuthentication();
                $scope.getAdministration();
            }
            if (AuthFactory.checkRight('statistics_read')) {
                $scope.getAvailableStatsKeys();
            }
        });
    }]);
