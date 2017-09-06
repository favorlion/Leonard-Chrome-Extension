var LINKEDIN_SEARCH_PAGE = 'https://www.linkedin.com/search/results/index/';
var server_url = 'http://138.197.80.67:1337/';
// var server_url = 'http://localhost:1337/';
var leonard_running = false;
// var data_reset_done = true;
// var MAX_VIEWS = 500;
// var view_info = 'view_info';
var user_id = false;

chrome.browserAction.onClicked.addListener(function() {
    openNewTab(LINKEDIN_SEARCH_PAGE);
})

window.onload = function() {
    chrome.storage.local.get("user_details", function(ud) {
        if (!ud['user_details']) {
            return false;
        }
        user_id = ud['user_details']['id'];
        localStorage.setItem("today", getTodayDate());
    });
    chrome.browserAction.setBadgeText({
        text: ''
    });
}

function getTodayDate() {
    return (new Date()).toISOString().substring(0, 10);
}

function openNewTab(URL, callback) {
    chrome.tabs.create({
        url: URL
    }, function(new_tab){
        if(typeof callback == 'function'){
            callback(new_tab);
        }
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if(message.activate){
        chrome.tabs.highlight({
            tabs: sender.tab.index
        }, function(){
            sendResponse();
        })
    } else if (message.search_url_duplicate) {
        chrome.tabs.getAllInWindow(function(tabs) {
            var ls_count = 0;
            var tab_ids = [];
            tabs.forEach(function(tab) {
                if (tab.url.indexOf('www.linkedin.com/search') > -1 || tab.url.indexOf('www.linkedin.com/sales/search') > -1) {
                    ls_count++;
                    tab_ids.push(tab.index);
                }
            });
            sendResponse({
                ls_count: ls_count,
                tab_ids: tab_ids
            });
        })
    } else if (message.open_new_tab) {
        openNewTab(message.url);
        return false;
    } else if (message.register) {
        createNewUser(message, function(arg) {
            sendResponse(arg);
        })
    } else if (message.email && message.password) {
        getUserDetails(message, function(arg) {
            sendResponse(arg);
        });
    } else if (message.getUserViews) {
        $.ajax({
            url: server_url + 'get_views/' + user_id,
            type: 'GET',
            success: function(res) {
                if (typeof res == "string") {
                    res = JSON.parse(res);
                }
                if (res.views) {
                    sendResponse(res);
                }
            },
            complete: function(xhr) {
                if (xhr.status != 200) {
                    sendResponse(xhr);
                }
            }
        })
    } else if (message.getUserSentConnections) {
        $.ajax({
            url: server_url + 'get_connections/' + user_id,
            type: 'GET',
            success: function(res) {
                if (typeof res == "string") {
                    res = JSON.parse(res);
                }
                if (res.conns) {
                    sendResponse(res);
                }
            },
            complete: function(xhr) {
                if (xhr.status != 200) {
                    sendResponse(xhr);
                }
            }
        })
    } else if (message.saveData) {
        var data = $.extend({}, message.attrs);
        data.user_id = user_id;
        $.ajax({
            url: server_url + 'add_view',
            data: data,
            type: 'POST',
            success: function(resp) {
                // console.log(resp);
                if (typeof resp == 'string') {
                    resp = JSON.parse(resp);
                }
                if (resp.error) {
                    showNotification(resp.error);
                }
                sendResponse(resp);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.saveConnData) {
        var data = message.connObj;
        data.user_id = user_id;
        $.ajax({
            url: server_url + 'add_connection',
            data: data,
            type: 'POST',
            success: function(resp) {
                if (typeof resp == 'string') {
                    resp = JSON.parse(resp);
                }
                if (resp.error) {
                    showNotification(resp.error);
                }
                sendResponse(resp);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.updateConnectionStatus) {
        $.ajax({
            url: server_url + 'accepted_connection',
            data: {
                connection_id: message.connection_id
            },
            type: 'POST',
            success: function(resp) {
                if (typeof resp == 'string') {
                    resp = JSON.parse(resp);
                }
                if (resp.error) {
                    showNotification(resp.error);
                }
                sendResponse(resp);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.removeConnectionRequest) {
        $.ajax({
            url: server_url + 'remove_connection',
            data: {
                connection_id: message.connection_id
            },
            type: 'POST',
            success: function(resp) {
                sendResponse();
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.removeTemplate) {
        $.ajax({
            url: server_url + 'remove_template/' + message.template_id,
            type: 'POST',
            success: function(resp) {
                if (typeof resp == 'string') {
                    resp = JSON.parse(resp);
                }
                if (resp.error) {
                    showNotification(resp.error);
                }
                sendResponse(resp);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.reloadPage) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    reloadPage: true
                }, function(response) {});
            }
        });
    } else if (message.setBadge) {
        var bgColor = 'blue';
        if (message.mode == 'send') {
            bgColor = 'green';
        } else if(message.mode == 'message'){
            bgColor = 'red';
        }
        chrome.browserAction.setBadgeBackgroundColor({
            color: bgColor
        });
        chrome.browserAction.setBadgeText({
            text: message.setBadge
        });
    } else if (message.removeBadge) {
        chrome.browserAction.setBadgeText({
            text: ''
        });
    } else if (message.showNotification) {
        showNotification(message.showNotification, message.tabId || null);
    } else if (message.start_stop) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(tabs) {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    start_stop: true
                }, function(response) {});
            } else {
                showNotification("Please open LinkedIn search and try again");
            }
        });
    } else if (message.running) {
        leonard_running = message.runningState;
    } else if (message.getRunning) {
        sendResponse(leonard_running);
    } else if (message.resetViews) {
        // resetViews(function(){
        // 	sendResponse();
        // });
    } else if (message.getLatestData) {
        $.ajax({
            url: server_url + 'user/' + user_id,
            success: function(resp) {
                chrome.storage.local.get('user_details', function(ud) {
                    var user_details = ud.user_details;
                    user_details.profile_views_remaining_today = resp.user.profile_views_remaining_today;
                    user_details.connection_requests_remaining_today = resp.user.connection_requests_remaining_today;
                    user_details.user_type = resp.user.user_type;
                    chrome.storage.local.set({
                        'user_details': user_details
                    })
                    sendResponse(user_details);
                });
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.getTemplates) {
        $.ajax({
            url: server_url + 'get_templates/' + user_id,
            success: function(resp) {
                sendResponse(resp.templates);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.getInvitationMessages) {
        $.ajax({
            url: server_url + 'get_templates/',
            data: {
                user_id: user_id,
                template_type: 'connection_invitation'
            },
            success: function(resp) {
                sendResponse(resp.templates);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.getFollowUpMessages) {
        $.ajax({
            url: server_url + 'get_templates/',
            data: {
                user_id: user_id,
                template_type: 'follow_up_message'
            },
            success: function(resp) {
                sendResponse(resp.templates);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.saveTemplate) {
        $.ajax({
            url: server_url + 'add_template/',
            type: 'POST',
            data: {
                template_name: message.templateName,
                template_content: message.templateContent,
                user_id: user_id
            },
            success: function(resp) {
                chrome.tabs.getAllInWindow(function(tabs) {
                    var ls_count = 0;
                    var tab_ids = [];
                    tabs.forEach(function(tab) {
                        if (tab.url.indexOf('www.linkedin.com/search') > -1 || tab.url.indexOf('www.linkedin.com/sales/search') > -1) {
                            ls_count++;
                            tab_ids.push(tab.id);
                        }
                    });
                    tab_ids.forEach(function(tabId) {
                        chrome.tabs.sendMessage(tabId, {
                            setTemplates: true
                        }, function(response) {
                            chrome.tabs.highlight({
                                tabs: tabId
                            });
                        });
                    })
                })
                sendResponse(resp);
            },
            error: function(error) {
                sendResponse(error);
            }
        });
    } else if (message.sendFollowUpMessages) {
        chrome.tabs.getAllInWindow(function(tabs) {
            var ls_count = 0;
            var tab_ids = [];
            tabs.forEach(function(tab) {
                if (tab.url.indexOf('www.linkedin.com') > -1) {
                    ls_count++;
                    tab_ids.push(tab.id);
                }
            });
            if(tab_ids.length > 0){
                chrome.tabs.sendMessage(tab_ids[0], {
                    sendFollowUpMessages : true,
                    messages : message.messages
                },function(){
                    sendResponse();
                });
            } else {
                openNewTab(LINKEDIN_SEARCH_PAGE, function(new_tab){
                    setTimeout(function(){
                        showNotification("Opened LinkedIn for sending follow up messages!");
                        chrome.tabs.sendMessage(new_tab.id, {
                            sendFollowUpMessages : true,
                            messages : message.messages
                        },function(){
                            sendResponse();
                        });
                    },3000);
                });
            }
        })
    } else if (message.sendBulkMessages) {
        chrome.tabs.getAllInWindow(function(tabs) {
            var ls_count = 0;
            var tab_ids = [];
            tabs.forEach(function(tab) {
                if (tab.url.indexOf('www.linkedin.com') > -1) {
                    ls_count++;
                    tab_ids.push(tab.id);
                }
            });
            if(tab_ids.length > 0){
                chrome.tabs.sendMessage(tab_ids[0], {
                    sendBulkMessages : true,
                    messages : message.messages
                },function(){
                    sendResponse();
                });
            } else {
                openNewTab(LINKEDIN_SEARCH_PAGE, function(new_tab){
                    setTimeout(function(){
                        showNotification("Opened LinkedIn for posting the messages!");
                        chrome.tabs.sendMessage(new_tab.id, {
                            sendBulkMessages : true,
                            messages : message.messages
                        },function(){
                            sendResponse();
                        });
                    },3000);
                });
            }
        })
    } else if(message.reloadConnections){
        chrome.tabs.getAllInWindow(function(tabs) {
            var ls_count = 0;
            var tab_ids = [];
            tabs.forEach(function(tab) {
                if (tab.url.indexOf('www.linkedin.com') > -1) {
                    ls_count++;
                    tab_ids.push(tab.id);
                }
            });
            if(tab_ids.length > 0){
                chrome.tabs.sendMessage(tab_ids[0], {
                    reloadConnections : true
                },function(){
                    sendResponse();
                });
            } else {
                openNewTab(LINKEDIN_SEARCH_PAGE, function(new_tab){
                    setTimeout(function(){
                        showNotification("Opened LinkedIn for reloading the connections!");
                        chrome.tabs.sendMessage(new_tab.id, {
                            reloadConnections : true
                        },function(){
                            sendResponse();
                        });
                    },3000);
                });
            }
        })
    } else if(message.checkForAccepted){
        chrome.tabs.getAllInWindow(function(tabs) {
            var ls_count = 0;
            var tab_ids = [];
            tabs.forEach(function(tab) {
                if (tab.url.indexOf('www.linkedin.com') > -1) {
                    ls_count++;
                    tab_ids.push(tab.id);
                }
            });
            if(tab_ids.length > 0){
                chrome.tabs.sendMessage(tab_ids[0], {
                    checkForAccepted : true
                },function(isUpdated){
                    sendResponse(isUpdated);
                });
            } else {
                openNewTab(LINKEDIN_SEARCH_PAGE, function(new_tab){
                    setTimeout(function(){
                        showNotification("Opened LinkedIn for checking the accepted connections!");
                        chrome.tabs.sendMessage(new_tab, {
                            checkForAccepted : true
                        },function(isUpdated){
                            sendResponse(isUpdated);
                        });
                    },3000);
                });
            }
        })
    } else {
        console.log("Unexpected message \n " + JSON.stringify(message));
    }
    return true;
});

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason == "install") {
        chrome.storage.local.clear();
    }
})

function resetViews(callback) {
    chrome.storage.local.get('LINKEDIN_DATA_' + user_id, function(obj) {
        if (obj['LINKEDIN_DATA_' + user_id]) {
            local_data = obj['LINKEDIN_DATA_' + user_id];
            local_data.REMAINING_PROFILE_VIEWS = MAX_VIEWS;
            local_data.VISITED = 0;
            local_data.stop_after = 500;
        }
        var sobj = {};
        sobj['LINKEDIN_DATA_' + user_id] = local_data;
        chrome.storage.local.set(obj);
        localStorage.setItem("today", getTodayDate());
        if (typeof callback == 'function') callback();
    });
}

function createNewUser(msg, callback) {
    $.ajax({
        url: server_url + 'add_user',
        data: {
            firstname: msg.firstname,
            email: msg.email,
            password: msg.password,
            rest: true
        },
        type: 'POST',
        success: function(res) {
            if (typeof res == "string") {
                res = JSON.parse(res);
            }
            chrome.storage.local.set({
                "user_details": res
            });
            callback(res);
        },
        complete: function(xhr) {
            if (xhr.status != 200) {
                callback(xhr);
            }
        }
    })
}

function getUserDetails(msg, callback) {
    var email = msg.email;
    var password = msg.password;
    $.ajax({
        url: server_url + 'login',
        type: 'POST',
        data: {
            email: email,
            password: password,
            rest: true
        },
        success: function(resp) {
            if (typeof resp == "string") {
                resp = JSON.parse(resp);
            }
            if (resp && resp.id) {
                user_id = resp.id;
                if (msg.rememberMe) {
                    resp.password = msg.password;
                    resp.rememberMe = msg.rememberMe;
                }
                chrome.storage.local.get("user_details", function(ud) {
                    var saved_user_details = ud['user_details'];
                    if(saved_user_details && saved_user_details.current_linkedin_profile_id && saved_user_details.current_linkedin_profile_id == resp.linkedin_profile_id){
                        delete resp.current_linkedin_profile_id;
                        resp.autoLogIn = true;
                        chrome.storage.local.set({
                            user_details: resp
                        });
                    } else if(saved_user_details && saved_user_details.current_linkedin_profile_id){
                        resp.autoLogIn = false;
                        showNotification('You\'re logged in with other user in LinkedIn!\nPlease login to LinkedIn with the profile you created for Leonard!');
                        callback('error');
                        chrome.storage.local.set({
                            user_details: resp
                        });
                        return false;
                    } else {
                        resp.autoLogIn = true;
                        chrome.storage.local.set({
                            user_details: resp
                        });
                    }
                    chrome.tabs.query({
                        active: true,
                        currentWindow: true
                    }, function(tabs) {
                        if (tabs.length > 0) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                reloadPage: true
                            }, function(response) {});
                        }
                    });
                    callback('success');
                });
            } else {
                callback('error');
            }
        },
        error: function() {
            callback('error');
        }
    })
}

function showNotification(txt, tabId) {
    clearAllNotifications();
    chrome.notifications.onClicked.addListener(function() {
        if (tabId) {
            chrome.tabs.highlight({
                tabs: tabId
            });
        }
    })
    chrome.storage.local.get("user_details", function(ud) {
        var firstname = ud['user_details'] && ud['user_details']['firstname'] || 'Guest';
        chrome.notifications.create({
            title: "Hi " + firstname,
            iconUrl: chrome.runtime.getURL('images/icon-48.png'),
            type: 'basic',
            message: txt
        });
    });
}

function clearAllNotifications() {
    chrome.notifications.getAll(function(nots) {
        var notIds = Object.keys(nots);
        notIds.forEach(function(n) {
            chrome.notifications.clear(n)
        })
    })
}