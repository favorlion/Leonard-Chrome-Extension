var leonardApp = angular.module("app", ["ngRoute"]);
var user_details = [];
var totalConnections = [];
var site_url = 'http://138.197.80.67:1337/';

leonardApp.config(function($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('');
    $routeProvider.when("/", {
        templateUrl: "modules/connections.html",
        controller: 'connectionsCtrl'
    }).when("/accepted", {
        templateUrl: "modules/accepted.html",
        controller: 'acceptedCtrl'
    }).when("/pending", {
        templateUrl: "modules/pending.html",
        controller: 'pendingCtrl'
    }).when("/connection_invitation", {
        templateUrl: "modules/connection_invitation.html",
        controller: 'connInvCtrl'
    }).when("/follow_up_message", {
        templateUrl: "modules/follow_up_message.html",
        controller: 'follUpCtrl'
    }).when("/inmail", {
        templateUrl: "modules/inmail.html",
        controller: 'inmailCtrl'
    }).when("/tag", {
        templateUrl: "modules/tag.html",
        controller: 'tagCtrl'
    }).when("/login", {
        templateUrl: "modules/login.html",
        controller: 'loginCtrl'
    });
});

leonardApp.controller('connectionsCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        var that = this;
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $scope.connections = [];
        $scope.tags = [];
        $scope.taggedConns = [];
        $scope.tag = '';
        $scope.editMode = false;
        $scope.message = '';
        $.ajax({
            url: site_url + 'get_tagged_connections_of_user/',
            data: {
                user_id: user_details.id
            },
            success: function(resp) {
                $scope.taggedConns = resp;
            },
            async: false
        });
        $.ajax({
            url: site_url + 'get_tags/',
            data: {
                user_id: user_details.id
            },
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.tags = resp.tags.map(function(t) {
                        return t.tag_name
                    });
                });
            }
        });
        chrome.storage.local.get('connections', function(conns) {
            var total_conns = conns['connections'];
            if(!total_conns){
                chrome.runtime.sendMessage({reloadConnections:true}, function(){
                    $route.reload();
                })
                return false;
            }
            totalConnections = total_conns.slice(0);
            total_conns.forEach(function(c) {
                $scope.taggedConns.forEach(function(tc) {
                    if (c.publicIdentifier == tc.connection_id) {
                        c.tags = tc.tags;
                    }
                })
            });
            $scope.$apply(function() {
                $scope.connections = conns['connections'];
                that.connections = $scope.connections;
            });
            setTimeout(function() {
                hidePageLoader();
                initBootGrid(false, true, {
                    sendAllText : 'Message',
                    addTagsToUsers : true,
                    addTagsBtnClicked : function(){
                        $('#edit-multiple--tag').modal('show');
                    },
                    reloadClicked: function(){
                        chrome.runtime.sendMessage({reloadConnections:true}, function(){
                            $route.reload();
                        })
                    },
                    clickHandler: function() {
                        $scope.selected_conn_id = null;
                    },
                    editRecord: function(recId) {
                        $scope.selected_conn_id = recId;
                        var filteredConn = $scope.connections.filter(function(c) {
                            return c.publicIdentifier == recId
                        })
                        if (filteredConn && filteredConn.length > 0) {
                            $scope.tag = filteredConn[0].tags;
                        } else {
                            $scope.tag = null;
                        }
                        $scope.editMode = false;
                        $('#edit--tag').modal('show');
                        if ($scope.tag) {
                            tagSelect.val($scope.tag.split(',')).trigger('change');
                        } else {
                            tagSelect.val(null).trigger('change');
                        }
                    },
                    sendAll : function(){
                        $scope.$apply(function(){
                            $scope.message = '';
                        })
                        $('#modal--default').modal('show');
                    },
                    selectionChange : function(){
                        var grid = $("#data-table").data('.rs.jquery.bootgrid');
                        $scope.editMode = false;
                        if(grid.selectedRows.length > 0){
                            $(".row-selected").removeAttr('disabled');
                        } else {
                            $(".row-selected").attr('disabled','disabled');
                        }
                    }
                });
            }, 500);
        });
        $scope.sendMessageToSelected = function(){
            var grid = $("#data-table").data('.rs.jquery.bootgrid');
            if(grid.selectedRows.length == 0){
                swal({
                    title : 'Warning',
                    text : 'Please select at least one contact!'
                });
                return false;
            }
            var bulk_message_text = $scope.message;
            var messages = [];
            loadTotalConnections(function(){
                grid.selectedRows.forEach(function(a){
                    var firstName = '';
                    var entityURN = '';
                    totalConnections.forEach(function(c){
                        if(c.publicIdentifier == a){
                            firstName = c.firstName;
                            entityURN = c.entityUrn.replace('urn:li:fs_miniProfile:','');
                        }
                    });
                    var edited_bulk_message = bulk_message_text.replace(/%firstName%/g, firstName);
                    messages.push({
                        entityURN : entityURN,
                        message : edited_bulk_message
                    })
                });
                chrome.runtime.sendMessage({
                    sendBulkMessages : true,
                    messages : messages
                }, function(){
                    notify({
                        title : 'Message status : Sent',
                        message : 'Number of messages sent : '+grid.selectedRows.length+'/'+grid.selectedRows.length,
                        sendMessages: true,
                        type : 'success'
                    });
                    grid.deselect();
                });
            });
        }
        $scope.addToMessage = function(variable) {
            $scope.message = $scope.message + '' + variable;
        }
        $scope.saveTags = function() {
            var tags_val = $("#tag_select").val();
            if(tags_val && tags_val.length > 0){
                tags_val = tags_val.map(function(v) {
                    return v.replace(/^string:/, '')
                });
            }
            if(!tags_val){
                tags_val = "";
            }
            // if(!tags_val){
            //     swal({
            //         title: 'Warning',
            //         text: 'Please select at least one tag!'
            //     })
            //     return false;
            // }
            $scope.editMode = true;
            if ($scope.selected_conn_id) {
                addTagsToConnection(tags_val, $scope.selected_conn_id);
            } else {
                swal({
                    title: 'Error',
                    text: 'Cannot access this connection!'
                })
            }
        }
        $scope.addTagsToSelected = function(){
            var grid = $("#data-table").data('.rs.jquery.bootgrid');
            if(grid.selectedRows.length == 0){
                swal({
                    title : 'Warning',
                    text : 'Please select at least one contact!'
                });
                return false;
            }
            var tags_val = $("#tag_select_multiple").val();
            if(tags_val && tags_val.length > 0){
                tags_val = tags_val.map(function(v) {
                    return v.replace(/^string:/, '')
                });
            }
            if(!tags_val){
                tags_val = "";
            }
            // if(!tags_val){
            //     swal({
            //         title: 'Warning',
            //         text: 'Please select at least one tag!'
            //     })
            //     return false;
            // }
            $scope.editMode = true;
            addTagsToConnections(tags_val, grid.selectedRows, 0, function(){
                location.reload();
            })
        }
    }
]);

leonardApp.controller('acceptedCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $.ajax({
            url: site_url + 'get_connections/' + user_details.id,
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.invites = resp.conns;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(false, true, {
                        sendAllText : 'Send All',
                        deleteSelected: true,
                        deleteSelectedClicked: function(conn_ids){
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover these invitation(s)!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                removeConnectionInvitations(conn_ids, 0, function(){
                                    location.reload();
                                })
                            }, function() {});
                        },
                        reloadClicked: function(){
                            chrome.runtime.sendMessage({checkForAccepted:true}, function(isUpdated){
                                if(isUpdated){
                                    $route.reload();
                                } else {
                                    notify({
                                        title: "No new accepted connections   ",
                                        message: "",
                                        type:'warning'
                                    });
                                    enableRefreshIcon();
                                }
                            })
                        },
                        editRecord: function(recId) {
                            var temp = $scope.invites.filter(function(t) {
                                return t.id == recId
                            })[0];
                            $scope.$apply(function() {
                                $scope.title = temp.template_name;
                                $scope.message = temp.follow_up_message;
                                $scope.addOrEdit = 'Edit';
                                $scope.id = recId
                                $scope.edit = true;
                            });
                            $('#modal--default').modal('show');
                        },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this invitation!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_connection',
                                    data: {
                                        connection_id: recId
                                    },
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        },
                        sendMessage : function(recId){
                            chrome.runtime.sendMessage({reloadConnections:true},function(){
                                loadTotalConnections(function(){
                                    var temp = $scope.invites.filter(function(t) {
                                        return t.id == recId
                                    })[0];
                                    var recContact = totalConnections.filter(function(c){
                                        return c.publicIdentifier == temp.c_public_id
                                    });
                                    if(recContact && recContact.length > 0){
                                        var entityURN = recContact[0].entityUrn.replace('urn:li:fs_miniProfile:','');
                                        var firstName = recContact[0].firstName;
                                        var follow_up_message = temp.follow_up_message.replace(/%firstName%/g, firstName);
                                        if(!follow_up_message){
                                            showNotification("I can't send blank in Follow up message!\nCan you please update Follow up message?");
                                            return false;
                                        }
                                        chrome.runtime.sendMessage({
                                            sendFollowUpMessages : true,
                                            messages : [{
                                                entityURN : entityURN,
                                                message : follow_up_message
                                            }]
                                        }, function(){
                                            var invIds = $scope.invites.map(function(inv){
                                                return inv.id;
                                            });
                                            if(invIds.length > 0){
                                                $.ajax({
                                                    method: 'POST',
                                                    url: site_url + 'remove_connection',
                                                    data: {
                                                        connection_id: recId
                                                    },
                                                    success: function() {
                                                        location.reload();
                                                    }
                                                })
                                            }
                                        });
                                    }
                                });
                            })
                        },
                        sendAll : function(){
                            var accepted = $scope.invites.filter(function(i){
                                return i.is_accepted == "true"
                            });
                            var stopSending = false;
                            accepted.forEach(function(a){
                                if(a.follow_up_message == ""){
                                    stopSending = true;
                                }
                            });
                            if(stopSending){
                                showNotification("I can't send blank in Follow up message!\nCan you please update Follow up message?");
                                return false;
                            }
                            var messages = [];
                            accepted.forEach(function(a){
                                var firstName = a.c_name;
                                var entityURN = '';
                                totalConnections.forEach(function(c){
                                    if(c.publicIdentifier == a.c_public_id || c.objectUrn.indexOf(a.c_member_id) > -1){
                                        firstName = c.firstName;
                                        entityURN = c.entityUrn.replace('urn:li:fs_miniProfile:','');
                                    }
                                });
                                var follow_up_message = a.follow_up_message.replace(/%firstName%/g, firstName);
                                messages.push({
                                    entityURN : entityURN,
                                    message : follow_up_message
                                })
                            })
                            // console.log(messages);
                            // return false;
                            if(messages.length > 0){
                                chrome.runtime.sendMessage({
                                    sendFollowUpMessages : true,
                                    messages : messages
                                }, function(){
                                    var invIds = $scope.invites.filter(function(inv){
                                        return inv.is_accepted == "true";
                                    });
                                    if(invIds.length > 0){
                                        $.ajax({
                                            method: 'POST',
                                            url: site_url + 'remove_connections',
                                            data: {
                                                is_accepted: true,
                                                user_id : user_details.id
                                            },
                                            success: function() {
                                                location.reload();
                                            }
                                        })
                                    }
                                });
                            } else {
                                showNotification("You've already sent follow up messages\nto all accepted connections requests!");
                            }
                        },
                        selectionChange : function(){
                            var grid = $("#data-table").data('.rs.jquery.bootgrid');
                            $scope.editMode = false;
                            if(grid.selectedRows.length > 0){
                                $(".row-selected").removeAttr('disabled');
                            } else {
                                $(".row-selected").attr('disabled','disabled');
                            }
                        }
                    });
                }, 500);
            }
        })
        $scope.addToMessage = function(variable) {
            $scope.message = $scope.message + '' + variable;
        }
        $scope.updateTemplate = function() {
            $.ajax({
                method: 'POST',
                url: site_url + 'update_connection/' + $scope.id,
                data: {
                    follow_up_message: $scope.message
                },
                success: function() {
                    location.reload();
                }
            })
        }
    }
]);

leonardApp.controller('pendingCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $.ajax({
            url: site_url + 'get_connections/' + user_details.id,
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.invites = resp.conns;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(false, true,{
                        deleteSelected: true,
                        deleteSelectedClicked: function(conn_ids){
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover these invitation(s)!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                removeConnectionInvitations(conn_ids, 0, function(){
                                    location.reload();
                                },true);
                            }, function() {});
                        },
                        reloadClicked: function(){
                            chrome.runtime.sendMessage({checkForAccepted:true}, function(isUpdated){
                                if(isUpdated){
                                    $route.reload();
                                } else {
                                    notify({
                                        title: "No new pending connections   ",
                                        message: "",
                                        type:'warning'
                                    });
                                    enableRefreshIcon();
                                }
                            })
                        },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this invitation!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_connection',
                                    data: {
                                        connection_id: recId
                                    },
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        },
                        selectionChange : function(){
                            var grid = $("#data-table").data('.rs.jquery.bootgrid');
                            $scope.editMode = false;
                            if(grid.selectedRows.length > 0){
                                $(".row-selected").removeAttr('disabled');
                            } else {
                                $(".row-selected").attr('disabled','disabled');
                            }
                        }
                    });
                }, 500);
            }
        })
    }
]);

leonardApp.controller('connInvCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $scope.template_type = 'connection_invitation';
        $scope.template_type_txt = 'Connection Invitation';
        $scope.title = '';
        $scope.message = '';
        $scope.addOrEdit = 'Add';
        $.ajax({
            url: site_url + 'get_templates/',
            data: {
                user_id: user_details.id,
                template_type: $scope.template_type
            },
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.templates = resp.templates;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(true, false, {
                        reloadClicked: function(){
                            $route.reload();
                        },
                        clickHandler: function() {
                            $scope.$apply(function() {
                                $scope.edit = false;
                                $scope.id = '';
                                $scope.addOrEdit = 'Add';
                                $scope.title = '';
                                $scope.message = '';
                            })
                        },
                        editRecord: function(recId) {
                            var temp = $scope.templates.filter(function(t) {
                                return t.id == recId
                            })[0];
                            $scope.$apply(function() {
                                $scope.title = temp.template_name;
                                $scope.message = temp.template_content;
                                $scope.addOrEdit = 'Edit';
                                $scope.id = recId
                                $scope.edit = true;
                            });
                            $('#modal--default').modal('show');
                        },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this template!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_template/' + recId,
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        }
                    });
                }, 500);
            }
        })
        $scope.addToMessage = function(variable) {
            $scope.message = $scope.message + '' + variable;
        }
        $scope.saveTemplate = function(variable) {
            $.ajax({
                method: 'POST',
                url: site_url + 'add_template',
                data: {
                    user_id: user_details.id,
                    template_name: $scope.title,
                    template_content: $scope.message,
                    template_type: $scope.template_type
                },
                success: function() {
                    location.reload();
                }
            })
        }
        $scope.updateTemplate = function() {
            $.ajax({
                method: 'POST',
                url: site_url + 'update_template/' + $scope.id,
                data: {
                    template_name: $scope.title,
                    template_content: $scope.message
                },
                success: function() {
                    location.reload();
                }
            })
        }
    }
]);

leonardApp.controller('follUpCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $scope.template_type = 'follow_up_message';
        $scope.template_type_txt = 'Follow Up Message';
        $scope.title = '';
        $scope.message = '';
        $scope.addOrEdit = 'Add';
        $.ajax({
            url: site_url + 'get_templates/',
            data: {
                user_id: user_details.id,
                template_type: $scope.template_type
            },
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.templates = resp.templates;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(true, false, {
                        reloadClicked: function(){
                            $route.reload();
                        },
                        clickHandler: function() {
                            $scope.$apply(function() {
                                $scope.edit = false;
                                $scope.id = '';
                                $scope.addOrEdit = 'Add';
                                $scope.title = '';
                                $scope.message = '';
                            })
                        },
                        editRecord: function(recId) {
                            var temp = $scope.templates.filter(function(t) {
                                return t.id == recId
                            })[0];
                            $scope.$apply(function() {
                                $scope.title = temp.template_name;
                                $scope.message = temp.template_content;
                                $scope.addOrEdit = 'Edit';
                                $scope.id = recId
                                $scope.edit = true;
                            });
                            $('#modal--default').modal('show');
                        },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this template!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_template/' + recId,
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        }
                    });
                }, 500);
            }
        })
        $scope.addToMessage = function(variable) {
            $scope.message = $scope.message + '' + variable;
        }
        $scope.saveTemplate = function(variable) {
            $.ajax({
                method: 'POST',
                url: site_url + 'add_template',
                data: {
                    user_id: user_details.id,
                    template_name: $scope.title,
                    template_content: $scope.message,
                    template_type: $scope.template_type
                },
                success: function() {
                    location.reload();
                }
            })
        }
        $scope.updateTemplate = function() {
            $.ajax({
                method: 'POST',
                url: site_url + 'update_template/' + $scope.id,
                data: {
                    template_name: $scope.title,
                    template_content: $scope.message
                },
                success: function() {
                    location.reload();
                }
            })
        }
    }
]);

leonardApp.controller('inmailCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $scope.template_type = 'inmail';
        $scope.template_type_txt = 'InMail';
        $scope.title = '';
        $scope.message = '';
        $scope.addOrEdit = 'Add';
        $.ajax({
            url: site_url + 'get_templates/',
            data: {
                user_id: user_details.id,
                template_type: $scope.template_type
            },
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.templates = resp.templates;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(true, false, {
                        reloadClicked: function(){
                            $route.reload();
                        },
                        clickHandler: function() {
                            $scope.$apply(function() {
                                $scope.edit = false;
                                $scope.id = '';
                                $scope.addOrEdit = 'Add';
                                $scope.title = '';
                                $scope.message = '';
                            })
                        },
                        editRecord: function(recId) {
                            var temp = $scope.templates.filter(function(t) {
                                return t.id == recId
                            })[0];
                            $scope.$apply(function() {
                                $scope.title = temp.template_name;
                                $scope.message = temp.template_content;
                                $scope.addOrEdit = 'Edit';
                                $scope.id = recId
                                $scope.edit = true;
                            });
                            $('#modal--default').modal('show');
                        },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this template!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_template/' + recId,
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        }
                    });
                }, 500);
            }
        })
        $scope.addToMessage = function(variable) {
            $scope.message = $scope.message + '' + variable;
        }
        $scope.saveTemplate = function(variable) {
            $.ajax({
                method: 'POST',
                url: site_url + 'add_template',
                data: {
                    user_id: user_details.id,
                    template_name: $scope.title,
                    template_content: $scope.message,
                    template_type: $scope.template_type
                },
                success: function() {
                    location.reload();
                }
            })
        }
        $scope.updateTemplate = function() {
            $.ajax({
                method: 'POST',
                url: site_url + 'update_template/' + $scope.id,
                data: {
                    template_name: $scope.title,
                    template_content: $scope.message
                },
                success: function() {
                    location.reload();
                }
            })
        }
    }
]);

leonardApp.controller('tagCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        showPageLoader();
        if(!user_details || !user_details.autoLogIn){
            $location.path('/login');
            return false;
        }
        $scope.template_type_txt = 'Tag';
        $scope.title = '';
        $.ajax({
            url: site_url + 'get_tags/',
            data: {
                user_id: user_details.id
            },
            success: function(resp) {
                $scope.$apply(function() {
                    $scope.tags = resp.tags;
                });
                setTimeout(function() {
                    hidePageLoader();
                    initBootGrid(true, false, {
                        reloadClicked: function(){
                            $route.reload();
                        },
                        clickHandler: function() {
                            $scope.$apply(function() {
                                $scope.title = '';
                            });
                        },
                        // editRecord : function(recId){
                        // 	console.log(recId);
                        // },
                        deleteRecord: function(recId) {
                            swal({
                                title: "Are you sure?",
                                text: "You will not be able to recover this template!",
                                type: "warning",
                                showCancelButton: true,
                                confirmButtonColor: "#DD6B55",
                                confirmButtonText: "Yes, delete it!"
                            }).then(function() {
                                $.ajax({
                                    method: 'POST',
                                    url: site_url + 'remove_tag/' + recId,
                                    success: function() {
                                        location.reload();
                                    }
                                })
                            }, function() {});
                        }
                    });
                }, 500);
            }
        })
        $scope.saveTag = function(variable) {
            $.ajax({
                method: 'POST',
                url: site_url + 'add_tag',
                data: {
                    user_id: user_details.id,
                    tag_name: $scope.title
                },
                success: function(resp) {
                    if (resp.success == "1") {
                        location.reload();
                    } else {
                        swal({
                            title: 'Error',
                            text: resp.message
                        });
                    }
                }
            })
        }
    }
]);

leonardApp.controller('loginCtrl', ['$scope', '$route', '$location', function($scope, $route, $location) {
        $("body").addClass("full-page");
        $scope.user_details = user_details;
        $scope.signIn = function(){
            // site_url
            chrome.runtime.sendMessage({email:$scope.user_details.email,password:$scope.user_details.password,rememberMe:$scope.user_details.rememberMe},function(resp){
                if(resp == "success"){
                    window.location.assign('/CRM/index.html');
                } else {
                    showNotification("You have entered an incorrect email or password. Please try again.");
                    $("#email").val("").trigger("focus");
                    $("#password").val("");
                    $("#remember").removeAttr("checked");
                }
            });
        }
        setTimeout(function(){
            hidePageLoader();
        },500);
    }
]);

leonardApp.controller('mainCtrl', ['$scope', '$location', function($scope, $location) {
        function setModule(newUrl){
            var module = newUrl.slice(newUrl.lastIndexOf('/') + 1)
            $scope.active_page = module == '' ? 'connections' : module;
        }
        getProfileDetails(function() {
            $scope.user_details = user_details;
            if(!user_details || !user_details.autoLogIn){
                showNotification("Please login to Leonard!");
                $location.path('/login');
                return false;
            } else {
                $scope.$on('$locationChangeSuccess', function(event, newUrl, oldUrl) {
                    setModule(newUrl);
                });
                loadTotalConnections();
            }
        });
        setModule($location.$$path);
    }
]);

function loadTotalConnections(callback){
    chrome.storage.local.get('connections', function(conns) {
        totalConnections = conns['connections'];
        if(typeof callback == 'function'){
            callback();
        }
    });
}