var leonardApp = angular.module('app', []);
var user_details = [];

leonardApp
    .controller('mainCtrl', function ($scope, $route) {
        var that = this;
        $scope.connections = [];
        $scope.accepted_connections = [];
        $scope.selectedTemp = location.hash.replace('#','');
        that.connections = $scope.connections;
        getProfileDetails(function(){
            $scope.user_details = user_details;
        });
    });
