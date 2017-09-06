var leonardApp = angular.module('app', []);
var user_details = [];

leonardApp
    .controller('mainCtrl', function ($scope) {
        var that = this;
        $scope.connections = [];
        $scope.accepted_connections = [];
        that.connections = $scope.connections;
        getProfileDetails();
        chrome.storage.local.get('connections',function(conns){
            $scope.$apply(function(){
                $scope.connections = conns['connections'];
            })
        });
        getConnectionsSent(function(acc_conns){
            $scope.$apply(function(){
                $scope.accepted_connections = acc_conns;
                // $scope.connections.forEach(function(c){
                //     var member_id = c['objectUrn'];
                //     acc_conns.filter(function(c){
                //         return member_id.match(c.conn_sent_to);
                //     })
                // })
            })
        })
    });
