myApp.factory("MonitoringFactory", ["AuthFactory", "$http", "monitoringUrl",
    function (AuthFactory, $http, monitoringUrl) {
        /**
         Each service - just like this service factory - is a singleton.
         */
        return {

            get_stats_keys: function (callback) {
                $http.get(monitoringUrl + "/", {
                    headers: { 'Authorization': AuthFactory.getAuthToken() },
                }).then(function (response) { callback(response.data) },
                    function (error) { AuthFactory.authError(error.data) });
            },

            get_monitored: function (stats_key,params, callback) {
                $http.get(monitoringUrl + "/" + stats_key, {
                    headers: { 'Authorization': AuthFactory.getAuthToken() },
                    params: params,
                }).then(function (response) { callback(response.data) },
                    function (error) { AuthFactory.authError(error.data) });
            },
        }
    }]);

myApp.directive('timelineChart', function () {
    return {
        restrict: 'E',
        scope: {
            tokenTimeline: '=', 
        },
        template: `<div style="position:relative; width:100%; height:300px;"><canvas></canvas></div>`,
        link: function (scope, element) {
            var chart = new Chart(element.find('canvas')[0], {
                type: 'line',
                data: {
                    datasets: scope.tokenTimeline.datasets
                },
                options: {
                    responsive: true, maintainAspectRatio: false, // Anpassung an Element in dem Chart liegt
                    plugins: {
                        legend: {
                            display: true,
                            align: 'start',
                            labels: {
                                generateLabels: (chart) => {
                                    const originalLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);

                                    return originalLabels.map(label => {
                                        const isVisible = chart.isDatasetVisible(label.datasetIndex);

                                        if (!isVisible) {
                                            label.text = '☐ ' + label.text.replace('☐ ', '').replace('☑ ', '');
                                        } else {
                                            label.text = '☑ ' + label.text.replace('☐ ', '').replace('☑ ', '');
                                        }

                                        label.hidden = false;

                                        return label;
                                    });
                                }
                            },
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                tooltipFormat: 'dd.MM.yyyy HH:mm:ss',
                            },
                            ticks: {
                                callback: function (value) {
                                    const d = new Date(value);
                                    const pad = n => String(n).padStart(2, '0');
                                    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                                },
                                autoSkip: true,
                                maxRotation: 45,
                                autoSkipPadding: 20,
                                maxTicksLimit: 20
                            },

                        },

                        y: { beginAtZero: false, ticks: { precision: 0 } }
                    },
                }
            }
            );
            scope.$watch('tokenTimeline', function (c) {
                if (!c) return;
                chart.data.datasets = c.datasets;
                chart.update();
            }, true);
            scope.$on('$destroy', function () { chart.destroy(); });
        }
    };
});