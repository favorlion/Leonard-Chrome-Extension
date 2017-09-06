var isSalesNav = false, viewPremiumOnly = false, idUrnMapObj, usersList, user_details, views, sent_connections, invitationMessages, followUpMessages;
var finished_in_remaining = 0, finished_conns_in_remaining = 0, currentIdx = 0, search_records_count = 0;
var start_next_page_timer = false, startInter = false, nextViewInter = false, nextViewTimer = false, page_load_timer = false, resetInter = false;
var VIEWING_TIMER = 5000, REQMANAGER_TIMER = 30000;
var ONE_DAY = 24 * 60 * 60 * 1000;
var local_data = {
    rpv: 0,
    rcr: 0,
    month_active: 30,
    selectedTemplate: false,
    selectedInvitationMessage: false,
    selectedFollowUpMessage: false,
    week_active: 7,
    EXT_FOLDER: chrome.extension.getURL(''),
    REMAINING_PROFILE_VIEWS: 0,
    REMAINING_CONNECTION_REQUESTS: 0,
    VISITED: 0,
    SKIPPED: 0,
    VISITED_IN_WEEK: 0,
    SKIPPED_IN_WEEK: 0,
    TOTAL_VISITED: 0,
    TOTAL_SKIPPED: 0
};
var connections_all = [];

$(document).ready(function() {
    getProfileDetails();
    initIntervals();
    initExtension();
    reloadConnections();
    // injectCodeIntoPage();
});


/*
	chrome extension message handler
*/

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.reloadPage) {
        location.reload();
    } else if (message.start_stop) {
        if ($("#start_viewing").length == 0 && location.href.match('www.linkedin.com/vsearch') == null) {
            showNotification("Please open LinkedIn search and try again");
            return false;
        }
        if ($("#start_viewing").length > 0) {
            $("#start_viewing").trigger("click");
        } else {
            showNotification("You've used your limit for today, please wait for " + getNextDateTimeStamp());
        }
    } else if (message.setTemplates) {
        populateTemplates();
    } else if(message.sendFollowUpMessages){
        sendFollowUpMessages(message.messages, 0, function(){
            sendResponse();
        });
    } else if(message.sendBulkMessages){
        sendBulkMessages(message.messages, 0, function(){
            sendResponse();
        });
    } else if(message.reloadConnections){
        reloadConnections(function(){
            sendResponse();
        });
    } else if(message.checkForAccepted){
        reloadConnections(function(){
            checkForAcceptedConnections(function(isUpdated){
                sendResponse(isUpdated);
            });
        })
    }
    return true;
});

/*
	Essential methods
*/

function injectCodeIntoPage(){
    var src = chrome.extension.getURL('js/inject.js');
    $('<script />',{'type':'text/javascript','src':src}).appendTo($('head'));
    $("<div />",{'id':'leonard_inject','hidden':true}).appendTo($('body'));
    document.getElementById("leonard_inject").addEventListener('TRACK_WITH_EVENT_FOUND',function(){
        // var text = $('#leonard_inject').text();
        // console.log(text);
        if(nextViewInter || nextViewTimer || currentIdx > 0){
            stopLeonard();
            showNotification("I stopped the process,\nbecause you updated the search!");
        }
    });
}

function initIntervals() {
    startInter = setInterval(function() {
        if (user_details && document.cookie.indexOf('leo_auth_token') > 0) {
            clearInterval(startInter);
            startInter = null;
            logOutUserFromLeonard();
            return false;
        }
        if (document.querySelectorAll("#start_viewing").length > 0) {
            var startViewBtnClasses = document.querySelectorAll("#start_viewing")[0].classList
            try {
                chrome.runtime.sendMessage({
                    running: true,
                    runningState: startViewBtnClasses.contains("started")
                })
            } catch (err) {
                clearInterval(startInter);
                startInter = null;
                chrome.storage.local.set({
                    nextPageRedirect: false
                }, function() {
                    location.reload();
                })
            }
        }
        if (isSalesNav) {
            if (location.href.indexOf('www.linkedin.com/sales/search') >= 0 && document.querySelectorAll("#Ext_Header").length == 0) {
                initExtension();
            } else if (location.href.indexOf('www.linkedin.com/sales/search') == -1) {
                $("#Ext_Header").remove();
            }
        } else if (user_details) {
            if (location.href.indexOf('www.linkedin.com/search') >= 0 && document.querySelectorAll("#Ext_Header").length == 0) {
                initExtension();
            } else if (location.href.indexOf('www.linkedin.com/search') == -1) {
                $("#Ext_Header").remove();
            }
        }
        //  else {
        // 	clearInterval(startInter);
        // 	startInter = false;
        // }
    }, 200);
    // reqManagerAgent = setInterval(function() {
    //     checkForAcceptedConnections();
    // }, REQMANAGER_TIMER);
}

function initExtension() {
    setupExtensionVars(function() {
        chrome.storage.local.get('user_details', function(ud) {
            if (!ud.user_details || !ud.user_details.autoLogIn) {
                return false;
            }
            user_details = ud.user_details;
            if (!user_details || !user_details.profile_views_remaining_today) {
                return false;
            } else {
                getLatestData(function() {
                    local_data.REMAINING_PROFILE_VIEWS = parseInt(user_details.profile_views_remaining_today);
                    local_data.REMAINING_CONNECTION_REQUESTS = parseInt(user_details.connection_requests_remaining_today);
                    local_data.rpv = local_data.REMAINING_PROFILE_VIEWS;
                    local_data.rcr = local_data.REMAINING_CONNECTION_REQUESTS;
                    if (local_data.REMAINING_PROFILE_VIEWS == 0) {
                        showTimerPage();
                    } else {
                        showLeonardHeader(function(isLoaded) {
                            if (!isLoaded) {
                                setTimeout(initExtension, 500);
                                return false;
                            }
                            $(".leo_container").removeAttr("hidden");
                            chrome.runtime.sendMessage({
                                'getUserViews': true
                            }, function(uv) {
                                views = uv.views || [];
                                chrome.runtime.sendMessage({
                                    'getUserSentConnections': true
                                }, function(sc) {
                                    sent_connections = sc && sc.conns || [];
                                    updateLocalData(function() {
                                        if (local_data.REMAINING_PROFILE_VIEWS == 0) {
                                            showTimerPage();
                                        } else {
                                            chrome.storage.local.get('nextPageRedirect', function(obj) {
                                                if (obj['nextPageRedirect']) {
                                                    finished_in_remaining = obj['nextPageRedirect'].count ? parseInt(obj['nextPageRedirect'].count) : false;
                                                    finished_conns_in_remaining = obj['nextPageRedirect'].conns_count ? parseInt(obj['nextPageRedirect'].conns_count) : false;
                                                    chrome.storage.local.set({
                                                        nextPageRedirect: false
                                                    }, function() {
                                                        if (finished_in_remaining != false) {
                                                            $("#start_viewing").text("STOP");
                                                            $("#start_viewing").addClass("started");
                                                            startViewing();
                                                        } else if (finished_conns_in_remaining != false) {
                                                            $("#start_sending_conn").text("STOP");
                                                            $("#start_sending_conn").addClass("started");
                                                            startSending();
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    })
                                })
                            })
                        });
                    }
                })
            }
        });
    })
}

function setupExtensionVars(callback) {
    usersList = [];
    if ($("code[id^=bpr-guid-]:last").length > 0) {
        var json_data = JSON.parse($("code[id^=bpr-guid-]:last").text());
        if (json_data && json_data.included) {
            usersList = json_data.included.filter(function(a) {
                return a.objectUrn
            });
            idUrnMapObj = {};
            usersList.forEach(function(a) {
                idUrnMapObj[a.publicIdentifier] = a.objectUrn;
            });
        }
        search_records_count = $(".results-list > li").length;
    } else if ($("#results").length > 0) {
        search_records_count = $("#results > li[data-li-entity-id]").length;
    } else if ($("#results-list").length > 0) {
        search_records_count = $("#results-list > li").length;
    }
    if (search_records_count == 0) {
        if (page_load_timer) {
            clearTimeout(page_load_timer);
            page_load_timer = false;
        }
        page_load_timer = setTimeout(function() {
            setupExtensionVars(callback);
        }, 2000);
        return false;
    }
    if (location.href.indexOf('https://www.linkedin.com/sales/search') >= 0) {
        isSalesNav = true;
    }
    chrome.runtime.sendMessage({
        search_url_duplicate: true
    }, function(obj) {
        if (obj && obj.ls_count > 1) {
            showNotification("I'm using LinkedIn in other tab, please click here to switch!", obj.tab_ids[0]);
            clearInterval(startInter);
            startInter = null;
            return false;
        } else {
            chrome.storage.local.get('view_premium_only', function(r) {
                if (r.view_premium_only) {
                    viewPremiumOnly = true;
                } else {
                    viewPremiumOnly = false;
                }
            })
        }
        if (typeof callback == 'function') {
            callback();
        }
    });
}

function showLeonardHeader(callback) {
    // if($("#Ext_Header").length > 0) $("#Ext_Header").remove();
    if ($("#Ext_Header").length > 0) return false;
    var extMainCont = $('#srp_main_');
    if (extMainCont.length == 0 && !isSalesNav) {
        extMainCont = $(".sub-nav--trans-nav");
    } else if (isSalesNav) {
        extMainCont = $(".spotlights-wrapper");
    }
    if (extMainCont.length == 0) {
        callback(false);
    }
    $('<div />', {
        'id': 'Ext_Header'
    }).prependTo(extMainCont);
    var home_page = chrome.extension.getURL('template/home.html');
    if (isSalesNav) {
        home_page = chrome.extension.getURL('template/sales_nav_template.html');
    }
    $.get(home_page, function(resp) {
        resp.match(/{{(.*?)}}/g).forEach(function(a) {
            var m = local_data[a.replace(/\{|\}/g, '')] || 0;
            resp = resp.replace(a, m);
        });
        $("#Ext_Header").addClass("new_design_header");
        if (isSalesNav) {
            $("#Ext_Header").addClass("sales_nav_temp_header");
        }
        $('#Ext_Header').html(resp);

        if (isSalesNav) {
            $(".hunt_ops").css("width", $(".results-header").width());
            chrome.storage.local.get('sales_tab', function(o) {
                if (o && o.sales_tab) {
                    $(".leo_nav li:eq('" + o.sales_tab + "')").click();
                }
            })
        }
        /*	Template listeners	*/

        $("#start_viewing").bind("click", function() {
            if (local_data.REMAINING_PROFILE_VIEWS <= 0) {
                local_data.REMAINING_PROFILE_VIEWS = 0;
                showNotification("You completed your daily views!");
                return false;
            }
            if ($("#start_viewing").hasClass("started")) {
                $("#start_viewing").text("START");
                $("#start_viewing").removeClass("started");
                clearInterval(nextViewInter);
                nextViewInter = null;
                clearTimeout(nextViewTimer);
                nextViewTimer = null;
                $(".leo_visiting").find(".time_rem_span").remove()
                $(".leo_visiting").removeClass("leo_visiting");
                chrome.runtime.sendMessage({
                    removeBadge: true
                });
                chrome.storage.local.set({
                    nextPageRedirect: false
                });
                local_data.rpv = local_data.REMAINING_PROFILE_VIEWS;
                // saveLocalData();
            } else {
                local_data.rpv = parseInt($("#range_slider").val());
                $("#start_viewing").text("STOP");
                $("#start_viewing").addClass("started");
                finished_in_remaining = 0;
                currentIdx = 0;
                startViewing();
            }
        });

        $("#view_premium_only").prop("checked", viewPremiumOnly);

        $("#view_premium_only").bind("change", function() {
            if ($("#view_premium_only").is(":checked")) {
                viewPremiumOnly = true;
            } else {
                viewPremiumOnly = false;
            }
            chrome.storage.local.set({
                "view_premium_only": viewPremiumOnly
            });
        });

        $("#download_btn").bind("click", function() {
            showNotification("Leonard preparing your download\nPlease wait...");
            chrome.runtime.sendMessage({
                'getUserViews': true
            }, function(uv) {
                createCSVFile(uv.views, function(csv_data) {
                    var fileName = "Leonard_profiles_" + getTodaysDate();
                    var uri = 'data:text/csv;charset=utf-8,' + escape(csv_data);
                    var link = document.createElement("a");
                    link.href = uri;
                    link.style = "visibility:hidden";
                    link.download = fileName + ".csv";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return false;
                })
            })
        });

        $(".leo_nav li").bind("click", function() {
            if ($(this).attr("disabled") == "disabled") {
                showNotification($(this).text()+" is under development!");
                return false;
            }
            var selected_tab = $(this).attr('data-tab');
            if (selected_tab != 'go_to_crm') {
                $(".leo_nav li").removeClass("active");
                $(this).addClass("active");
                $(".leo_container > table").hide();
                $("#" + selected_tab).show();
            }
            chrome.storage.local.get('sales_tab', function(o) {
                if (o && o.sales_tab) {
                    chrome.storage.local.remove('sales_tab');
                } else {
                    switch (selected_tab) {
                        case 'connection_invitation':
                            // if(isSalesNav){
                            // 	// if($(".selected-value-pill").length >= 1 && $(".selected-value-pill").attr("data-value") != "S"){
                            // 	// 	clearAllSelectedValues(function(){
                            // 	// 		chrome.storage.local.set({sales_tab:'1'},function(){
                            // 	// 			if(location.href.indexOf('search?trackingInfoJson.contextId') > 0){
                            // 	// 				location.href = location.href.replace(/search\?trackingInfoJson.contextId/g,'search?facet=N&facet.N=S&count=25&start=0&updateHistory=true&trackingInfoJson.contextId');
                            // 	// 			} else if(location.href.indexOf('facet=N&') > 0){
                            // 	// 				location.href = location.href.replace(/facet=N&/,'facet=N&facet.N=S&');
                            // 	// 			}
                            // 	// 		});
                            // 	// 	});
                            // 	// } else if($(".selected-value-pill").attr("data-value") != "S"){
                            // 	// 	chrome.storage.local.set({sales_tab:'1'},function(){
                            // 	// 		if(location.href.indexOf('search?trackingInfoJson.contextId') > 0){
                            // 	// 			location.href = location.href.replace(/search\?trackingInfoJson.contextId/g,'search?facet=N&facet.N=S&count=25&start=0&updateHistory=true&trackingInfoJson.contextId');
                            // 	// 		} else if(location.href.indexOf('facet=N&') > 0){
                            // 	// 			location.href = location.href.replace(/facet=N&/,'facet=N&facet.N=S&');
                            // 	// 		} else if(location.href.indexOf('facet=N&') == -1){
                            // 	// 			location.href = location.href+'&facet=N&facet.N=S';
                            // 	// 		}
                            // 	// 		return false;
                            // 	// 	});
                            // 	// }
                            // } else {
                            // 	if($("[name=1st]").is(":checked")){
                            // 		$("[name=1st]").click();
                            // 	}
                            // 	if($("[name=2nd]").is(":checked") == false){
                            // 		$("[name=1st]").click();
                            // 	}
                            // }
                            populateTemplates();
                            break;
                        case 'go_to_crm':
                            chrome.runtime.sendMessage({
                                open_new_tab: true,
                                url: chrome.runtime.getURL('CRM/index.html')
                            });
                            break;
                    }
                }
            });
        })
        chrome.storage.local.get('sales_tab', function(o) {
            if (o && o.sales_tab) {
                $(".leo_nav li:eq('" + o.sales_tab + "')").click();
            } else {
                $(".leo_nav li:first").click();
            }
        })
        if (local_data.REMAINING_CONNECTION_REQUESTS == 0) {
            $("#conn_range_slider").attr("min", "0").rangeslider('update', true).trigger("input");
        }

        $("#start_sending_conn").bind("click", function() {
            if (!local_data.selectedInvitationMessage) {
                showNotification("Please select invitation message!");
                return false;
            }
            if (local_data.REMAINING_CONNECTION_REQUESTS <= 0) {
                local_data.REMAINING_CONNECTION_REQUESTS = 0;
                showNotification("You sent maximum connection requests for today!");
                return false;
            }
            if ($("#start_sending_conn").hasClass("started")) {
                $("#start_sending_conn").text("SEND");
                $("#start_sending_conn").removeClass("started");
                clearInterval(nextViewInter);
                nextViewInter = null;
                clearTimeout(nextViewTimer);
                nextViewTimer = null;
                $(".leo_visiting").find(".time_rem_span").remove();
                $(".leo_visiting").removeClass("leo_visiting");
                chrome.runtime.sendMessage({
                    removeBadge: true
                });
                chrome.storage.local.set({
                    nextPageRedirect: false
                });
                local_data.rcr = local_data.REMAINING_CONNECTION_REQUESTS;
            } else {
                local_data.rcr = parseInt($("#conn_range_slider").val());
                $("#start_sending_conn").text("STOP");
                $("#start_sending_conn").addClass("started");
                finished_conns_in_remaining = 0;
                currentIdx = 0;
                startSending();
            }
        })

        callback(true);
    });
}

function showTimerPage() {
    var extMainCont = $('#srp_main_');
    if (extMainCont.length == 0) {
        extMainCont = $(".sub-nav--trans-nav");
    }
    if ($("#Ext_Header").length > 0) $("#Ext_Header").remove();
    $('<div />', {
        'id': 'Ext_Header'
    }).prependTo(extMainCont);
    var timer_page = chrome.extension.getURL('template/timer.html');
    $.get(timer_page, function(resp) {
        resp.match(/{{(.*?)}}/g).forEach(function(a) {
            var m = local_data[a.replace(/\{|\}/g, '')] || 0;
            resp = resp.replace(a, m);
        })
        $('#Ext_Header').html(resp);
        startResetTimer();
    });
}

function startResetTimer() {
    if (resetInter) {
        clearInterval(resetInter);
        resetInter = false;
    }
    resetInter = setInterval(function() {
        $("#time_remaining_to_reset").text("Leonard resets in : " + getNextDateTimeStamp());
    }, 500);
}

function startViewing() {
    if(search_records_count < 1){
    	setupExtensionVars(function(){
    		startViewing();
    	});
    	return false;
    }
    setupExtensionVars(function(){
        updateLocalData(function() {
            var cont_div = $(".results-list > li").eq(currentIdx);
            if (isSalesNav) {
                cont_div = $("#results-list > li").eq(currentIdx);
            }
            if (viewPremiumOnly) {
                while (cont_div.find(".premium-icon, .premiumicon, .linkedin-premium-icon").length == 0 && currentIdx <= search_records_count) {
                    currentIdx++;
                    cont_div = $(".results-list > li").eq(currentIdx);
                    if ($("#results").length > 0) {
                        cont_div = $("#results > li[data-li-entity-id]").eq(currentIdx);
                    } else if ($("#results-list").length > 0) {
                        cont_div = $("#results-list > li").eq(currentIdx);
                    }
                }
            }
            if ((cont_div.length == 0 && finished_in_remaining > 0) || currentIdx > search_records_count - 1) {
                chrome.storage.local.set({
                    nextPageRedirect: {
                        count: finished_in_remaining
                    }
                }, function() {
                    if ($(".next").length > 0) {
                        $(".next").click();
                    } else if ($(".next a").length > 0) {
                        window.location.href = location.origin + $(".next a").attr("href");
                    } else if (isSalesNav && $(".next-pagination").length > 0) {
                        $(".next-pagination")[0].click();
                    } else {
                        showNotification("There are no profiles remaining to view");
                        resetAllIntervals();
                        chrome.storage.local.set({
                            nextPageRedirect: false
                        });
                        chrome.runtime.sendMessage({
                            removeBadge: true
                        });
                        $("#start_viewing").text("START");
                        $("#start_viewing").removeClass("started");
                        return false;
                    }
                    startNextPageTimer('view');
                });
                return false;
            }
            if(cont_div.length == 0 || cont_div.find("div > a:first").length == 0){
                showNotification("There seems to be empty results for your search\nPlease update your search!");
                stopLeonard();
                return false;
            }
            var elOffset = cont_div.offset().top;
            var elHeight = cont_div.height();
            var windowHeight = $(window).height();
            var offset;
            if (elHeight < windowHeight) {
                offset = elOffset - ((windowHeight / 2) - (elHeight / 2));
            } else {
                offset = elOffset;
            }
            $('html, body').animate({scrollTop:offset}, 100);
            /* code for scrolling into view (ember bug)*/
            if(cont_div.hasClass("search-result__occlusion-hint")){
                setTimeout(startViewing,1000);
                return false;
            }
            var profile_id = cont_div.find("div > a:first").attr("href").slice(4, -1);
            var viewed_linkedin_member_id;
            var view_url = cont_div.find("div > a:first").attr("href");
            if (view_url.indexOf('www.linkedin.com') == -1) {
                view_url = 'https://www.linkedin.com' + view_url;
            }
            if (isSalesNav) {
                view_url = cont_div.find("a.name-link")[0].href;
                viewed_linkedin_member_id = cont_div.find("[name=memberId]").val();
            } else {
                if (idUrnMapObj[profile_id]) {
                    viewed_linkedin_member_id = idUrnMapObj[profile_id].slice(14);
                }
            }
            var view_found_idx;
            if(!views){
                setTimeout(function(){
                    showNotification("Requesting server for new data\nPlease wait!");
                    startViewing();
                },3000);
                return false;
            }
            views.forEach(function(view, idx) {
                if ((view.viewed_linkedin_profile_id == profile_id) || (viewed_linkedin_member_id && (view.viewed_linkedin_member_id == viewed_linkedin_member_id))) {
                    view_found_idx = idx;
                }
            });
            cont_div.find(".time_rem_span").remove();
            if (views[view_found_idx]) {
                // views[view_found_idx]['skipped']++;
                cont_div.find(".search-result__info").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Skipped'));
                if (isSalesNav) {
                    cont_div.find(".content-wrapper").prepend($('<span />', {
                        'class': 'time_rem_span'
                    }).text('Skipped'));
                } else if (cont_div.find(".bd").length > 0) {
                    cont_div.find(".bd").prepend($('<span />', {
                        'class': 'time_rem_span'
                    }).text('Skipped'));
                }
                cont_div.addClass("leo_skipped");
                currentIdx++;
                startViewing(currentIdx);
            } else {
                cont_div.addClass("leo_visiting");
                cont_div.find(".search-result__info").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Visiting'));
                if (isSalesNav) {
                    cont_div.find(".content-wrapper").prepend($('<span />', {
                        'class': 'time_rem_span'
                    }).text('Visiting'));
                } else if (cont_div.find(".bd").length > 0) {
                    cont_div.find(".bd").prepend($('<span />', {
                        'class': 'time_rem_span'
                    }).text('Visiting'));
                }

                $.ajax({
                    url: view_url,
                    success: function(response) {
                        var scraper = new Scraper(view_url, response);
                        scraper.attrs.viewed_linkedin_profile_id = profile_id;
                        scraper.attrs.viewed_linkedin_member_id = viewed_linkedin_member_id;
                        scraper.onScrapeComplete = function() {
                            // console.log(this.attrs);
                            if (isSalesNav && this.attrs.viewed_linkedin_profile_url) {
                                this.attrs.viewed_linkedin_profile_id = this.attrs.viewed_linkedin_profile_url.slice(this.attrs.viewed_linkedin_profile_url.lastIndexOf('/') + 1);
                            }
                            finished_in_remaining++;
                            currentIdx++;
                            local_data.REMAINING_PROFILE_VIEWS--;
                            if (local_data.rpv <= finished_in_remaining || local_data.REMAINING_PROFILE_VIEWS <= 0) {
                                clearInterval(nextViewInter);
                                nextViewInter = null;
                                clearTimeout(nextViewTimer);
                                nextViewTimer = null;
                                chrome.storage.local.set({
                                    nextPageRedirect: false
                                });
                                $("#start_viewing").text("START");
                                $("#start_viewing").removeClass("started");
                                saveViewToDB(this.attrs, function(error) {
                                    updateLocalData(function() {
                                        currentIdx = 0;
                                        chrome.runtime.sendMessage({
                                            removeBadge: true
                                        })
                                        showNotification("I've finished viewing " + finished_in_remaining + " profile(s) for you");
                                        cont_div.find(".time_rem_span").text('Visited');
                                        cont_div.removeClass("leo_visiting").addClass("leo_visited");
                                    })
                                })
                                return false;
                            } else {
                                saveViewToDB(this.attrs, function(error) {
                                    var RANDOM_TIMER = randomInRange(5,15);
                                    updateLocalData(function() {
                                        var end_timer = Date.now() + RANDOM_TIMER;
                                        if (nextViewInter) {
                                            clearInterval(nextViewInter);
                                            nextViewInter = null;
                                        }
                                        nextViewInter = setInterval(function() {
                                            if (!$("#start_viewing").hasClass("started")) {
                                                clearTimeout(nextViewInter);
                                                nextViewInter = null;
                                                return false;
                                            }
                                            var end_time = Math.round((end_timer - Date.now()) / 1000);
                                            if (end_time < 1) {
                                                clearInterval(nextViewInter);
                                                nextViewInter = null;
                                            }
                                            if (viewPremiumOnly) {
                                                while (cont_div.find(".premium-icon, .premiumicon, .linkedin-premium-icon").length == 0 && currentIdx <= search_records_count) {
                                                    currentIdx++;
                                                    cont_div = $(".results-list > li").eq(currentIdx);
                                                    if ($("#results").length > 0) {
                                                        cont_div = $("#results > li[data-li-entity-id]").eq(currentIdx);
                                                    } else if ($("#results-list").length > 0) {
                                                        cont_div = $("#results-list > li").eq(currentIdx);
                                                    }
                                                }
                                            }
                                            end_time = end_time + " secs";
                                            cont_div.addClass("leo_visiting");
                                            cont_div.find(".time_rem_span").remove();
                                            cont_div.find(".search-result__info").prepend($('<span />', {
                                                'class': 'time_rem_span'
                                            }).text('Visiting in ' + end_time));
                                            if (isSalesNav) {
                                                cont_div.find(".content-wrapper").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Visiting in ' + end_time));
                                            } else if (cont_div.find(".bd").length > 0) {
                                                cont_div.find(".bd").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Visiting in ' + end_time));
                                            }
                                        }, 1000);
                                        if (nextViewTimer) {
                                            clearTimeout(nextViewTimer);
                                            nextViewTimer = null;
                                        }
                                        nextViewTimer = setTimeout(function() {
                                            cont_div.find(".time_rem_span").remove();
                                            cont_div.removeClass("leo_visiting").addClass("leo_visited");
                                            cont_div.find(".search-result__info").prepend($('<span />', {
                                                'class': 'time_rem_span'
                                            }).text('Visited'));
                                            if (isSalesNav) {
                                                cont_div.find(".content-wrapper").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Visited'));
                                            } else if (cont_div.find(".bd").length > 0) {
                                                cont_div.find(".bd").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Visited'));
                                            }
                                            chrome.runtime.sendMessage({
                                                setBadge: finished_in_remaining.toString(),
                                                mode: 'view'
                                            });
                                            if (!$("#start_viewing").hasClass("started")) {
                                                clearTimeout(nextViewTimer);
                                                nextViewTimer = null;
                                                return false;
                                            }
                                            clearInterval(nextViewInter);
                                            nextViewInter = null;
                                            startViewing(currentIdx);
                                        }, RANDOM_TIMER);
                                    })
                                })
                            }
                        }
                        scraper.scrapeData();
                    },
                    error: function() {
                        cont_div.addClass("leo_visit_error");
                        currentIdx++;
                        startViewing(currentIdx);
                    }
                });
            }
        });
    });
}

function startSending() {
    if (search_records_count < 1) {
        setupExtensionVars(function() {
            startSending();
        });
        return false;
    }
    setupExtensionVars(function(){
        var cont_div = $(".results-list > li").eq(currentIdx);
        if (isSalesNav) {
            cont_div = $("#results-list > li").eq(currentIdx);
        }
        // if(viewPremiumOnly){
        // 	while(cont_div.find(".premium-icon, .premiumicon, .linkedin-premium-icon").length == 0 && currentIdx <= search_records_count){
        // 		currentIdx++;
        // 		cont_div = $(".results-list > li").eq(currentIdx);
        // 		if($("#results").length > 0){
        // 			cont_div = $("#results > li[data-li-entity-id]").eq(currentIdx);
        // 		} else if($("#results-list").length > 0) {
        // 			cont_div = $("#results-list > li").eq(currentIdx);
        // 		}
        // 	}
        // }
        if ((cont_div.length == 0 && finished_conns_in_remaining > 0) || currentIdx > search_records_count - 1) {
            chrome.storage.local.set({
                nextPageRedirect: {
                    conns_count: finished_conns_in_remaining
                }
            }, function() {
                if ($(".next").length > 0) {
                    $(".next").click();
                } else if ($(".next a").length > 0) {
                    window.location.href = location.origin + $(".next a").attr("href");
                } else if (isSalesNav && $(".next-pagination").length > 0 && !$(".next-pagination").hasClass("disabled")) {
                    $(".next-pagination")[0].click();
                } else {
                    showNotification("There are no profiles remaining to connect");
                    resetAllIntervals();
                    chrome.storage.local.set({
                        nextPageRedirect: false
                    });
                    chrome.runtime.sendMessage({
                        removeBadge: true
                    });
                    $("#start_sending_conn").text("SEND");
                    $("#start_sending_conn").removeClass("started");
                    return false;
                }
                startNextPageTimer('send');
            });
            return false;
        }
        if(cont_div.length == 0 || cont_div.find("div > a:first").length == 0){
            activateThisTab(function(){
                setTimeout(function(){
                    $("#start_sending_conn").text("STOP");
                    $("#start_sending_conn").addClass("started");
                    startSending();
                },1000);
            })
            showNotification("Activating LinkedIn tab, as results are not loaded!");
            stopLeonard(true);
            return false;
        }
        // cont_div[0].scrollIntoView();
        var elOffset = cont_div.offset().top;
    	var elHeight = cont_div.height();
    	var windowHeight = $(window).height();
    	var offset;
    	if (elHeight < windowHeight) {
    		offset = elOffset - ((windowHeight / 2) - (elHeight / 2));
    	} else {
    		offset = elOffset;
    	}
    	$('html, body').animate({scrollTop:offset}, 100);
    	/* code for scrolling into view (ember bug)*/
    	if(cont_div.hasClass("search-result__occlusion-hint")){
    		setTimeout(startSending,1000);
    		return false;
    	}
        var btnText = cont_div.find("button").text().trim();
        var profile_id = cont_div.find("div > a:first").attr("href").slice(4, -1);
        var viewed_linkedin_member_id;
        var view_url = cont_div.find("div > a:first").attr("href");
        if (view_url.indexOf('www.linkedin.com') == -1) {
            view_url = 'https://www.linkedin.com' + view_url;
        }
        if (isSalesNav) {
            view_url = cont_div.find("a.name-link")[0].href;
            btnText = cont_div.find("button.action.connect").text().trim();
            viewed_linkedin_member_id = cont_div.find("[name=memberId]").val();
        } else {
            if (idUrnMapObj[profile_id]) {
                viewed_linkedin_member_id = idUrnMapObj[profile_id].slice(14);
            }
        }
        var conn_found_idx;
        sent_connections.forEach(function(conn, idx) {
            if (conn.c_public_id == profile_id || conn.c_member_id == viewed_linkedin_member_id) {
                conn_found_idx = idx;
            }
        });
        cont_div.find(".time_rem_span").remove();
        if (sent_connections[conn_found_idx]) {
            // views[view_found_idx]['skipped']++;
            cont_div.find(".search-result__info").prepend($('<span />', {
                'class': 'time_rem_span'
            }).text('Already sent'));
            if (isSalesNav) {
                cont_div.find(".content-wrapper").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Already sent'));
            } else if (cont_div.find(".bd").length > 0) {
                cont_div.find(".bd").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Already sent'));
            }
            cont_div.addClass("leo_skipped");
            currentIdx++;
            startSending(currentIdx);
        } else if (btnText != 'Connect') {
            cont_div.find(".search-result__info").prepend($('<span />', {
                'class': 'time_rem_span'
            }).text('Cannot connect'));
            if (isSalesNav) {
                cont_div.find(".content-wrapper").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Cannot connect'));
            } else if (cont_div.find(".bd").length > 0) {
                cont_div.find(".bd").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Cannot connect'));
            }
            cont_div.addClass("leo_skipped");
            currentIdx++;
            startSending(currentIdx);
        } else {
            cont_div.addClass("leo_visiting");
            cont_div.find(".search-result__info").prepend($('<span />', {
                'class': 'time_rem_span'
            }).text('Sending connection request'));
            if (isSalesNav) {
                cont_div.find(".content-wrapper").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Sending connection request'));
            } else if (cont_div.find(".bd").length > 0) {
                cont_div.find(".bd").prepend($('<span />', {
                    'class': 'time_rem_span'
                }).text('Sending connection request'));
            }
            var invMesObj = invitationMessages.filter(function(t) {
                return t.id == local_data.selectedInvitationMessage
            })[0];
            var folUpObj = followUpMessages.filter(function(t) {
                return t.id == local_data.selectedFollowUpMessage
            })[0];
            $.ajax({
                url: view_url,
                success: function(response) {
                    // find profile identifier
                    scrapeDataFromResponse(view_url, response, viewed_linkedin_member_id, function(attrs) {
                        var firstName = attrs.firstname;
                        var lastName = attrs.lastname;
                        var publicIdentifier = attrs.publicIdentifier;
                        var profile_id = attrs.member_id;
                        sendConnection(attrs, function() {
                            finished_conns_in_remaining++;
                            currentIdx++;
                            local_data.REMAINING_CONNECTION_REQUESTS--;
                            if (local_data.rcr <= finished_conns_in_remaining || local_data.REMAINING_CONNECTION_REQUESTS <= 0) {
                                clearInterval(nextViewInter);
                                nextViewInter = null;
                                clearTimeout(nextViewTimer);
                                nextViewTimer = null;
                                chrome.storage.local.set({
                                    nextPageRedirect: false
                                });
                                $("#start_sending_conn").text("SEND");
                                $("#start_sending_conn").removeClass("started");
                                var connObj = {
                                    c_name: firstName + " " + lastName,
                                    c_profile_url: view_url,
                                    c_public_id: publicIdentifier,
                                    c_member_id: profile_id,
                                    invitation_message: invMesObj.template_content,
                                    follow_up_message: folUpObj && folUpObj.template_content || ''
                                }
                                saveConnToDB(connObj, function(error) {
                                    updateLocalData(function() {
                                        currentIdx = 0;
                                        chrome.runtime.sendMessage({
                                            removeBadge: true
                                        })
                                        showNotification("I've finished sending " + finished_conns_in_remaining + " connection requests for you");
                                        cont_div.find(".time_rem_span").text('Connection request sent');
                                        cont_div.removeClass("leo_visiting").addClass("leo_visited");
                                    })
                                })
                                return false;
                            } else {
                                var connObj = {
                                    c_name: firstName + " " + lastName,
                                    c_profile_url: view_url,
                                    c_public_id: publicIdentifier,
                                    c_member_id: profile_id,
                                    invitation_message: invMesObj.template_content,
                                    follow_up_message: folUpObj && folUpObj.template_content || ''
                                }
                                saveConnToDB(connObj, function(error) {
                                    var RANDOM_TIMER = randomInRange(5,15);
                                    updateLocalData(function() {
                                        var end_timer = Date.now() + RANDOM_TIMER;
                                        if (nextViewInter) {
                                            clearInterval(nextViewInter);
                                            nextViewInter = null;
                                        }
                                        nextViewInter = setInterval(function() {
                                            if (!$("#start_sending_conn").hasClass("started")) {
                                                clearTimeout(nextViewInter);
                                                nextViewInter = null;
                                                return false;
                                            }
                                            var end_time = Math.round((end_timer - Date.now()) / 1000);
                                            if (end_time < 1) {
                                                clearInterval(nextViewInter);
                                                nextViewInter = null;
                                            }
                                            // if(viewPremiumOnly){
                                            // 	while(cont_div.find(".premium-icon, .premiumicon, .linkedin-premium-icon").length == 0 && currentIdx <= search_records_count){
                                            // 		currentIdx++;
                                            // 		cont_div = $(".results-list > li").eq(currentIdx);
                                            // 		if($("#results").length > 0){
                                            // 			cont_div = $("#results > li[data-li-entity-id]").eq(currentIdx);
                                            // 		} else if($("#results-list").length > 0) {
                                            // 			cont_div = $("#results-list > li").eq(currentIdx);
                                            // 		}
                                            // 	}
                                            // }
                                            end_time = end_time + " secs";
                                            cont_div.addClass("leo_visiting");
                                            cont_div.find(".time_rem_span").remove();
                                            cont_div.find(".search-result__info").prepend($('<span />', {
                                                'class': 'time_rem_span'
                                            }).text('Sending connection request in ' + end_time));
                                            if (isSalesNav) {
                                                cont_div.find(".content-wrapper").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Sending connection request in ' + end_time));
                                            } else if (cont_div.find(".bd").length > 0) {
                                                cont_div.find(".bd").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Sending connection request in ' + end_time));
                                            }
                                        }, 1000);
                                        if (nextViewTimer) {
                                            clearTimeout(nextViewTimer);
                                            nextViewTimer = null;
                                        }
                                        nextViewTimer = setTimeout(function() {
                                            cont_div.find(".time_rem_span").remove();
                                            cont_div.removeClass("leo_visiting").addClass("leo_visited");
                                            cont_div.find(".search-result__info").prepend($('<span />', {
                                                'class': 'time_rem_span'
                                            }).text('Connection request sent'));
                                            if (isSalesNav) {
                                                cont_div.find(".content-wrapper").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Connection request sent'));
                                            } else if (cont_div.find(".bd").length > 0) {
                                                cont_div.find(".bd").prepend($('<span />', {
                                                    'class': 'time_rem_span'
                                                }).text('Connection request sent'));
                                            }
                                            chrome.runtime.sendMessage({
                                                setBadge: finished_conns_in_remaining.toString(),
                                                mode: 'send'
                                            });
                                            if (!$("#start_sending_conn").hasClass("started")) {
                                                clearTimeout(nextViewTimer);
                                                nextViewTimer = null;
                                                return false;
                                            }
                                            clearInterval(nextViewInter);
                                            nextViewInter = null;
                                            startSending(currentIdx);
                                        }, RANDOM_TIMER);
                                    });
                                })
                            }
                        })
                    });
                },
                error: function() {
                    cont_div.addClass("leo_visit_error");
                    currentIdx++;
                    startSending(currentIdx);
                }
            });
        }
    })
}

function scrapeDataFromResponse(view_url, response, profile_id, callback) {
    var attrs = {};
    if (isSalesNav) {
        var scraper = new Scraper(view_url, response);
        scraper.onScrapeComplete = function() {
            var key_arr = view_url.replace(/.*?profile\//, '').split('?');
            var profile_id = key_arr[0].split(',')[0];
            var authToken = key_arr[0].split(',')[1];
            var authType = key_arr[0].split(',')[2];
            var key_obj = key_arr[1].split('&');
            var moduleKey, pageKey, contextId, requestId;
            key_obj.forEach(function(k) {
                switch (k.split('=')[0]) {
                    case 'moduleKey':
                        moduleKey = k.split('=')[1];
                        break;
                    case 'pageKey':
                        pageKey = k.split('=')[1];
                        break;
                    case 'contextId':
                        contextId = k.split('=')[1];
                        break;
                    case 'requestId':
                        requestId = k.split('=')[1];
                        break;
                }
            })
            attrs = {
                firstname: this.attrs.firstname,
                lastname: this.attrs.lastname,
                moduleKey: moduleKey,
                pageKey: pageKey,
                contextId: contextId,
                requestId: requestId,
                viewed_linkedin_member_id: profile_id,
                member_id: this.attrs.member_id,
                publicIdentifier: this.attrs.publicIdentifier || this.attrs.member_id,
                authToken: authToken,
                authType: authType
            }
            if (typeof callback == 'function') callback(attrs);
        };
        scraper.scrapeData();
    } else {
        var json_codes = response.match(/>\s+{.*}\s+</g);
        var trackingId = '',
            firstName = '',
            lastName = '',
            publicIdentifier = '',
            profile_identifier = '';
        if(json_codes && json_codes.length > 0){
            json_codes.forEach(function(jc) {
                var etosp = jc.replace(/>\s+/, '').replace(/\s+</, '')
                try {
                    var js_obj = JSON.parse($('<textarea />').html(etosp).val());
                    if (js_obj && js_obj.data && js_obj.data.patentView) {
                        js_obj.included.filter(function(inc) {
                            if (inc.$type == 'com.linkedin.voyager.identity.shared.MiniProfile') {
                                trackingId = inc.trackingId;
                                firstName = inc.firstName;
                                lastName = inc.lastName;
                                profile_id = inc.objectUrn.replace('urn:li:member:','');
                                publicIdentifier = inc.publicIdentifier;
                                profile_identifier = inc.entityUrn.replace('urn:li:fs_miniProfile:', '');
                            }
                        })
                    }
                } catch (err) {
                    console.log("Failed to get user details to send connection request");
                    clearInterval(nextViewInter);
                    nextViewInter = null;
                    clearTimeout(nextViewTimer);
                    nextViewTimer = null;
                    chrome.storage.local.set({
                        nextPageRedirect: false
                    });
                    $("#start_sending_conn").text("SEND");
                    $("#start_sending_conn").removeClass("started");
                    return false;
                }
            });
        }
        attrs = {
            firstname: firstName,
            lastname: lastName,
            profile_identifier: profile_identifier,
            publicIdentifier: publicIdentifier,
            member_id : profile_id,
            trackingId: trackingId
        }
        if (typeof callback == 'function') callback(attrs);
    }
}


function startNextPageTimer(mode) {
    if (start_next_page_timer) {
        clearTimeout(start_next_page_timer);
        start_next_page_timer = null;
    }
    start_next_page_timer = setTimeout(function() {
        if ((
                $(".results-list > li").hasClass("leo_visited") ||
                $(".results-list > li").hasClass("leo_skipped") ||
                $(".results-list > li").hasClass("leo_visiting")
            ) ||
            (isSalesNav && (
                $("#results-list > li").hasClass("leo_visited") ||
                $("#results-list > li").hasClass("leo_skipped") ||
                $("#results-list > li").hasClass("leo_visiting")))
        ) {
            if ($(".leo_visited, .leo_visiting, .leo_skipped, .leo_visit_error").length == 0) {
                resetAllIntervals();
                chrome.runtime.sendMessage({
                    removeBadge: true
                });
                chrome.storage.local.set({
                    nextPageRedirect: false
                });
                if (mode == 'view') {
                    $("#start_viewing").text("START");
                    $("#start_viewing").removeClass("started");
                } else if (mode == 'send') {
                    $("#start_sending_conn").text("SEND");
                    $("#start_sending_conn").removeClass("started");
                } else {
                    console.log("forgot to send mode");
                }
                return false;
            } else {
                startNextPageTimer(mode);
            }
        } else {
            currentIdx = 0;
            clearTimeout(start_next_page_timer);
            start_next_page_timer = null;
            if (mode == 'view') {
                startViewing();
            } else if (mode == 'send') {
                startSending();
            }
        }
    }, 2000);
}

function saveViewToDB(attrs, callback) {
    chrome.runtime.sendMessage({
        attrs: attrs,
        saveData: true
    }, function(resp) {
        attrs.user_id = user_details.id;
        attrs.date_viewed = new Date();
        views.push(attrs);
        callback();
    })
}

function saveConnToDB(obj, callback) {
    chrome.runtime.sendMessage({
        connObj: obj,
        saveConnData: true
    }, function(resp) {
        callback();
    })
}

function updateLocalData(callback) {
    var month_ago_timestamp = Date.now() - (local_data.month_active * ONE_DAY);
    var week_ago_timestamp = Date.now() - (local_data.week_active * ONE_DAY);
    var today_views = Date.now() - (ONE_DAY);
    var deletable_indices = [];
    var visited_today = 0;
    var visited_in_week = 0;
    // var skipped_today = 0;
    // var skipped_in_week = 0;
    if(!views){
        setTimeout(function(){
            showNotification("Getting updated data\nPlease wait!");
            updateLocalData(callback);
        },3000);
        return false;
    }
    views.forEach(function(view, idx) {
        var viewed_at = Date.parse(view.date_viewed);
        if (viewed_at > week_ago_timestamp) {
            visited_in_week++;
        }
        // if(viewed_at < month_ago_timestamp){
        // 	deletable_indices.push(idx);
        // }
        if (viewed_at > today_views) {
            visited_today++;
        }
    });
    local_data.VISITED = visited_today;
    // local_data.SKIPPED = skipped_today;
    local_data.VISITED_IN_WEEK = visited_in_week;
    // local_data.SKIPPED_IN_WEEK = skipped_in_week;
    // deletable_indices.forEach(function(idx){
    // 	views.splice(idx,1);
    // });
    var total_visited = views.length;
    // var total_skipped = 0;
    // views.forEach(function(view){
    // 	total_skipped += parseInt(view.skipped) || 0;
    // });
    local_data.TOTAL_VISITED = total_visited;
    // local_data.TOTAL_SKIPPED = total_skipped;
    // DOM changes
    $("#today_visited").text(visited_today);
    // $("#today_skipped").text(skipped_today);
    $("#total_remaining").text(local_data.REMAINING_PROFILE_VIEWS);
    $("#visited_in_week").text(visited_in_week);
    // $("#skipped_in_week").text(skipped_in_week);
    $("#last_thirty_visited").text(total_visited);
    // $("#last_thirty_skipped").text(total_skipped);
    $("#range_slider").attr({
        "max": local_data.REMAINING_PROFILE_VIEWS,
        "value": local_data.rpv
    }).val(local_data.rpv).rangeslider('update', true).trigger("input");
    $("#conn_range_slider").attr({
        "max": local_data.REMAINING_CONNECTION_REQUESTS,
        "value": local_data.rcr
    }).val(local_data.rcr).rangeslider('update', true).trigger("input");
    if (typeof callback == 'function') {
        callback();
    }
}

function updateConnectionStatus(conn_arr, idx, callback) {
    var conn = conn_arr[idx];
    if (conn) {
        chrome.runtime.sendMessage({
            'updateConnectionStatus': true,
            'connection_id': conn
        }, function() {
            idx++;
            updateConnectionStatus(conn_arr, idx, callback);
        })
    }
    if (typeof callback == 'function') {
        callback();
    }
}

function removeConnectionRequest(conn_arr, idx, callback){
    var conn = conn_arr[idx];
    if (conn) {
        chrome.runtime.sendMessage({
            'removeConnectionRequest': true,
            'connection_id': conn
        }, function() {
            idx++;
            removeConnectionRequest(conn_arr, idx, callback);
        })
    }
    if (typeof callback == 'function') {
        callback();
    }
}

function getLatestData(callback) {
    chrome.runtime.sendMessage({
        getLatestData: true
    }, function(ud) {
        if (!ud || ud.status == 0) {
            showNotification("Server is not responding right now.\nPlease try again later.");
            return false;
        }
        user_details = ud;
        if (typeof callback == 'function') {
            callback();
        }
    })
}

function createCSVFile(user_views, callback) {
    var csv_data = "First Name,Last Name,EMAIL,PHONE,COUNTRY,INDUSTRY,WEBSITES,CURRENT_COMPANIES,BIRTHDAY,TWITTER_ACCOUNTS,LINKEDIN_URL\r\n";
    user_views.forEach(function(view) {
        csv_data += '"' + view['firstname'] + '"';
        csv_data += ",";
        csv_data += '"' + view['lastname'] + '"';
        csv_data += ",";
        csv_data += '"' + view['email'] + '"';
        csv_data += ",";
        csv_data += '"' + view['phone'] + '"';
        csv_data += ",";
        csv_data += '"' + view['country'] + '"';
        csv_data += ",";
        csv_data += '"' + view['industry'] + '"';
        csv_data += ",";
        csv_data += '"' + view['websites'] + '"';
        csv_data += ",";
        csv_data += '"' + view['current_companies'] + '"';
        csv_data += ",";
        csv_data += view['birthday'];
        csv_data += ",";
        csv_data += '"' + view['twitter_accounts'] + '"';
        csv_data += ",";
        csv_data += view['viewed_linkedin_profile_url'];
        csv_data += "\r\n";
    });
    callback(csv_data);
}

function getTemplates(callback) {
    chrome.runtime.sendMessage({
        getTemplates: true
    }, function(temps) {
        templates = temps;
        if (typeof callback == 'function') {
            callback(temps);
        }
    });
}

function getInvitationMessages(callback) {
    chrome.runtime.sendMessage({
        getInvitationMessages: true
    }, function(msgs) {
        invitationMessages = msgs;
        if (typeof callback == 'function') {
            callback(msgs);
        }
    })
}

function getFollowUpMessages(callback) {
    chrome.runtime.sendMessage({
        getFollowUpMessages: true
    }, function(msgs) {
        followUpMessages = msgs;
        if (typeof callback == 'function') {
            callback(msgs);
        }
    })
}

function populateTemplates() {
    getInvitationMessages(function(msgs) {
        $('#selInvMes').html('<option>Select invitation message</option>');
        msgs.forEach(function(m) {
            $('#selInvMes').append('<option value="' + m.id + '">' + m.template_name + '</option>');
        });
        local_data.selectedInvitationMessage = '';
        $('#selInvMes').unbind("change");
        $('#selInvMes').bind("change", function() {
            local_data.selectedInvitationMessage = $(this).val();
        })
    })
    getFollowUpMessages(function(msgs) {
        $('#selFollUpMes').html('<option>Select follow up message</option>');
        msgs.forEach(function(m) {
            $('#selFollUpMes').append('<option value="' + m.id + '">' + m.template_name + '</option>');
        });
        local_data.selectedFollowUpMessage = '';
        $('#selFollUpMes').unbind("change");
        $('#selFollUpMes').bind("change", function() {
            local_data.selectedFollowUpMessage = $(this).val();
        })
    })
}

function reloadConnections(callback) {
    getAllConnections(0, [], function(conns) {
        connections_all = conns;
        chrome.storage.local.set({
            connections: connections_all
        });
        if(typeof callback == 'function'){
            callback();
        }
    })
}

/*
	LinkedIn methods
*/

function activateThisTab(callback){
    chrome.runtime.sendMessage({activate:true},function(){
        if(typeof callback == 'function'){
            callback();
        }
    })
}

function checkForAcceptedConnections(callback){
    chrome.runtime.sendMessage({
        'getUserSentConnections': true
    }, function(sc) {
        sent_connections = sc && sc.conns || [];
        var conns_needs_update = [];
        var conns_needs_remove = [];
        if (sent_connections.length > 0) {
            getAllRequestsSent(0, [], function(total_conns_sent) {
                var sent_conns_pid = total_conns_sent.map(function(c) {
                    return c.toMember.publicIdentifier;
                });
                var sent_conns_mid = total_conns_sent.map(function(c) {
                    return c.toMember.objectUrn.replace('urn:li:member:','');
                });
                var total_conns_pid = connections_all.map(function(c){
                    return c.publicIdentifier;
                })
                var total_conns_mid = connections_all.map(function(c){
                    return c.objectUrn.replace('urn:li:member:','');
                })
                sent_connections.forEach(function(connObj) {
                    var recId = connObj.c_public_id;
                    var memberId = connObj.c_member_id;
                    if (connObj.is_accepted == "false" && (sent_conns_pid.indexOf(recId) == -1 || sent_conns_mid.indexOf(memberId) == -1) && (total_conns_pid.indexOf(recId) > -1 || total_conns_mid.indexOf(memberId) > -1)) {
                        conns_needs_update.push(connObj.id);
                        // sendFollowUpMessage();
                    }
                    // else if(sent_conns_pid.indexOf(recId) == -1) {
                    //     conns_needs_remove.push(connObj.id);
                    // }
                })
                if (conns_needs_update.length > 0) {
                    updateConnectionStatus(conns_needs_update, 0, function() {
                        // console.log("connections are updated in db");
                        if(typeof callback == 'function'){
                            callback(true);
                        }
                    })
                } else {
                    if(typeof callback == 'function'){
                        callback(false);
                    }
                }
                if(conns_needs_remove.length > 0){
                    removeConnectionRequest(conns_needs_remove, 0, function() {
                        // console.log("connections are removed from db");
                    })
                }
            });
        }
    });
}

function getProfileDetails() {
    var pageSource = document.body.innerHTML;
    var json_codes = pageSource.match(/>\s+{.*}\s+</g);
    var profile_img = null;
    var publicIdentifier = null;
    if (json_codes && json_codes.length > 0) {
        json_codes.forEach(function(jc) {
            var etosp = jc.replace(/>\s+/, '').replace(/\s+</, '')
            try {
                var js_obj = JSON.parse($('<textarea />').html(etosp).val());
                if (js_obj && js_obj.data && js_obj.data.$type && js_obj.data.$type == 'com.linkedin.voyager.common.Me') {
                    js_obj.included.forEach(function(inc) {
                        if (inc.$type) {
                            if (inc.$type == 'com.linkedin.voyager.common.MediaProcessorImage' && inc.$id.indexOf('picture') >= 0) {
                                profile_img = 'https://media.licdn.com/mpr/mpr/shrinknp_100_100' + inc.id;
                            }
                            if (inc.$type == 'com.linkedin.voyager.identity.shared.MiniProfile') {
                                publicIdentifier = inc.publicIdentifier;
                            }
                        }
                    })
                }
            } catch (err) {
                console.log("Caught error" + err);
            }
        });
        if (profile_img) {
            getUserDetails(function(ud) {
                if (ud) {
                    if (ud.linkedin_profile_id == publicIdentifier) {
                        ud.profile_img = profile_img;
                        chrome.storage.local.set({
                            "user_details": ud
                        });
                    } else if (ud.autoLogIn) {
                        ud.current_linkedin_profile_id = publicIdentifier;
                        chrome.storage.local.set({
                            "user_details": ud
                        });
                        showNotification('You\'re logged in with other user in LinkedIn!\nPlease login to LinkedIn with the profile you created for Leonard!');
                        logOutUserFromLeonard();
                        location.reload();
                        return false;
                    }
                }
            })
        }
    }
}

function getAllRequestsSent(page, requests, callback) {
    if(!document.cookie.match('JSESSIONID="(.*?)";')){
        return false;
    }
    var paging = 100;
    page = page || 0;
    requests = requests || [];
    $.ajax({
        url: 'https://www.linkedin.com/voyager/api/relationships/invitations?folder=SENT&start=' + page + '&count=' + paging,
        beforeSend: function(req) {
            var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
            req.setRequestHeader('csrf-token', csrf_token);
        },
        xhrFields: {
            withCredentials: true
        },
        success: function(resp) {
            requests = requests.concat(resp.elements);
            page += paging;
            if (resp.elements.length == paging) {
                getAllRequestsSent(page, requests, callback);
            } else if (typeof callback == 'function') {
                callback(requests);
            }
        }
    })
}

function getAllConnections(start, connections, callback) {
    if(!document.cookie.match('JSESSIONID="(.*?)";')){
        return false;
    }
    start = start || 0;
    connections = connections || [];
    var count = 2000;
    $.ajax({
        url: 'https://www.linkedin.com/voyager/api/relationships/connections?count=' + count + '&sortType=RECENTLY_ADDED&start=' + start,
        beforeSend: function(req) {
            var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
            req.setRequestHeader('csrf-token', csrf_token);
        },
        xhrFields: {
            withCredentials: true
        },
        success: function(resp) {
            resp.elements.forEach(function(con) {
                if (con.miniProfile && con.miniProfile.publicIdentifier) {
                    connections.push(con.miniProfile);
                }
            });
            if (resp.elements.length < count - 500) {
                if (typeof callback == 'function') {
                    callback(connections);
                }
            } else {
                start += resp.elements.length;
                getAllConnections(start, connections, callback);
            }
        }
    })
}

function getPeopleByFacet(page, callback) {
    page = page || 0;
    page *= 20;
    var recordCount = 20;
    var facetNetwork = location.search.match('facetNetwork=(.*?)&') ? escape(eval(unescape(location.search.match('facetNetwork=(.*?)&')[1])).join('|')) : '';
    if (!facetNetwork) {
        if (location.search.indexOf('facetNetwork') > -1) {
            location.search.indexOf('facetNetwork')
        }
        $('.search-facet__value.search-facet__value--network input').each(function() {
            if ($(this).is(":checked")) {
                if (facetNetwork) facetNetwork += '%7C';
                facetNetwork += $(this).attr("id").replace('sf-facetNetwork-', '');
            }
        })
    }
    if(!document.cookie.match('JSESSIONID="(.*?)";')){
        return false;
    }
    $.ajax({
        url: 'https://www.linkedin.com/voyager/api/search/cluster?count=' + recordCount + '&guides=List(v-%3EPEOPLE,facetNetwork-%3E' + facetNetwork + ')&origin=FACETED_SEARCH&q=guided&searchId=' + Date.now() + '&start=' + page,
        beforeSend: function(req) {
            var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
            req.setRequestHeader('csrf-token', csrf_token);
        },
        xhrFields: {
            withCredentials: true
        },
        success: function(resp) {
            var profiles = [];
            var elems = resp.elements[0].elements;
            elems.forEach(function(e) {
                var profile = e.hitInfo['com.linkedin.voyager.search.SearchProfile'].miniProfile;
                profiles.push(profile);
            });
            if (typeof callback == 'function') callback(profiles);
        },
        error: function(err) {
            if (typeof callback == 'function') callback(err);
        }
    })
}

function sendConnection(attrs, callback) {
    if(!document.cookie.match('JSESSIONID="(.*?)";')){
        return false;
    }
    var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
    var templateObj = invitationMessages.filter(function(t) {
        return t.id == local_data.selectedInvitationMessage
    })[0];
    if (!templateObj) {
        return false;
    }
    var tc = templateObj.template_content;
    if (isSalesNav) {
        var moduleKey = attrs.moduleKey;
        var pageKey = attrs.pageKey;
        var contextId = attrs.contextId;
        var requestId = attrs.requestId;
        var firstname = attrs.firstname;
        var viewed_linkedin_member_id = attrs.viewed_linkedin_member_id;
        var authToken = attrs.authToken;
        var authType = attrs.authType;
        var connect_url = 'https://www.linkedin.com/sales/profile/connect?trackingInfoJson.moduleKey=' + moduleKey + '&trackingInfoJson.pageKey=' + pageKey + '&trackingInfoJson.contextId=' + contextId + '&trackingInfoJson.requestId=' + requestId + '&trackingInfoJson.position=' + currentIdx + '&csrfToken=' + escape(csrf_token);
        // var data = '{"message":"#TEMPLATE_CONTENT#","pageKey":"#PAGE_KEY#","moduleKey":"#MODULE_KEY#","contextId":"#CONTEXT_ID#","requestId":"#REQUEST_ID#","position":"#CURRENT_IDX#","profileId":#PROFILE_ID#,"authToken":"#AUTH_TOKEN#","authType":"#AUTH_TYPE#"}';
        // data = data.replace('#MODULE_KEY#',moduleKey).replace('#PAGE_KEY#',pageKey).replace('#CONTEXT_ID#',contextId).replace('#REQUEST_ID#',requestId).replace('#CURRENT_IDX#',currentIdx).replace('#TEMPLATE_CONTENT#',tc).replace('#PROFILE_ID#',viewed_linkedin_member_id).replace('#AUTH_TOKEN#',authToken).replace('#AUTH_TYPE#',authType)
        tc = tc.replace(/%firstName%/g, firstname);
        data = {
            message: tc,
            pageKey: pageKey,
            moduleKey: moduleKey,
            contextId: contextId,
            requestId: requestId,
            position: currentIdx,
            profileId: viewed_linkedin_member_id,
            authToken: authToken,
            authType: authType
        }
        // console.log(connect_url);
        /*	
        	https://www.linkedin.com/sales/profile/connect
        	?trackingInfoJson.moduleKey=peopleSearchResults
        	&trackingInfoJson.pageKey=sales-search3-people-refinement
        	&trackingInfoJson.contextId=C687908E1995B214C0A66B72392B0000
        	&trackingInfoJson.requestId=68119d58-8e27-4e9a-bf02-e6acb00f2171
        	&trackingInfoJson.position=10
        	&csrfToken=ajax%3A4807006197797936721


        	https://www.linkedin.com/sales/profile/connect
        	?trackingInfoJson.moduleKey=peopleSearchResults
        	&trackingInfoJson.pageKey=sales-search3-people
        	&trackingInfoJson.contextId=C687908E1995B214C0A66B72392B0000
        	&trackingInfoJson.requestId=df45da89-e08d-4d44-bac2-5d54bb35da8d
        	&trackingInfoJson.position=0
        	&csrfToken=ajax
        */
        // console.log(data);
        // return false;
        $.ajax({
            url: connect_url,
            type: 'POST',
            data: JSON.stringify(data),
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            beforeSend: function(req) {
                req.setRequestHeader('csrf-token', csrf_token);
            },
            xhrFields: {
                withCredentials: true
            },
            complete: function(resp) {
                if (typeof callback == 'function') {
                    callback(resp);
                }
            }
        })
    } else {
        var firstname = attrs.firstname,
            profile_id = attrs.profile_identifier,
            trackingId = attrs.trackingId;
        tc = tc.replace(/%firstName%/g, firstname);
        $.ajax({
            url: 'https://www.linkedin.com/voyager/api/growth/normInvitations',
            type: 'POST',
            data: JSON.stringify({
                "trackingId": trackingId,
                "message": tc,
                "invitations": [],
                "invitee": {
                    "com.linkedin.voyager.growth.invitation.InviteeProfile": {
                        "profileId": profile_id
                    }
                }
            }),
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            beforeSend: function(req) {
                req.setRequestHeader('csrf-token', csrf_token);
            },
            xhrFields: {
                withCredentials: true
            },
            complete: function(resp) {
                if (typeof callback == 'function') {
                    callback(resp);
                }
            }
        })
    }
}

function sendFollowUpMessages(messages, idx, callback){
    if(!document.cookie.match('JSESSIONID="(.*?)";')){
        return false;
    }
    var message = messages[idx];
    if(message){
        var body = message.message;
        var entityUrn = message.entityURN;
        // //debugging
        // idx++;
        // sendFollowUpMessages(messages, idx, callback);
        // return false;
        $.ajax({
            url: 'https://www.linkedin.com/voyager/api/messaging/conversations?action=create',
            type: 'POST',
            data: JSON.stringify({
                "conversationCreate": {
                    "eventCreate" : {
                        "value" : {
                            "com.linkedin.voyager.messaging.create.MessageCreate" : {
                                "body" : body,
                                "attachments" : []
                            }
                        }
                    },
                    "recipients":[entityUrn],
                    "subtype" : "MEMBER_TO_MEMBER"
                }
            }),
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            beforeSend: function(req) {
                var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
                req.setRequestHeader('csrf-token', csrf_token);
            },
            xhrFields: {
                withCredentials: true
            },
            success: function(resp) {
                idx++;
                sendFollowUpMessages(messages, idx, callback);
            }
        });
    } else if(typeof callback == 'function'){
        callback();
    }
}

function sendBulkMessages(messages, idx, callback){
    var message = messages[idx];
    if(message){
        var body = message.message;
        var entityUrn = message.entityURN;
        $.ajax({
            url: 'https://www.linkedin.com/voyager/api/messaging/conversations?action=create',
            type: 'POST',
            data: JSON.stringify({
                "conversationCreate": {
                    "eventCreate" : {
                        "value" : {
                            "com.linkedin.voyager.messaging.create.MessageCreate" : {
                                "body" : body,
                                "attachments" : []
                            }
                        }
                    },
                    "recipients":[entityUrn],
                    "subtype" : "MEMBER_TO_MEMBER"
                }
            }),
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            beforeSend: function(req) {
                var csrf_token = document.cookie.match('JSESSIONID="(.*?)";')[1];
                req.setRequestHeader('csrf-token', csrf_token);
            },
            xhrFields: {
                withCredentials: true
            },
            success: function(resp) {
                idx++;
                chrome.runtime.sendMessage({
                    setBadge: idx.toString(),
                    mode: 'message'
                });
                sendBulkMessages(messages, idx, callback);
            }
        });
    } else if(typeof callback == 'function'){
        callback();
    }
}

function clearAllSelectedValues(callback) {
    if (!$(".results-loader-wrapper").hasClass("hidden")) {
        clearAllSelectedValues(callback);
        return false;
    }
    if ($(".selected-value-pill .dismiss-selection").length > 0) {
        setTimeout(function() {
            clearAllSelectedValues(callback);
        }, 2000);
        $(".selected-value-pill .dismiss-selection").eq(0).click();
    } else if (typeof callback == 'function') {
        callback();
    }
}

/*
	Utility methods
*/

function randomInRange(min, max){
    if (max == null) {
        max = min;
        min = 0;
    }
    return (min + Math.floor(Math.random() * (max - min + 1)))*1000;
}

function resetAllIntervals() {
    clearInterval(nextViewInter);
    nextViewInter = null;
    clearTimeout(nextViewTimer);
    nextViewTimer = null;
    clearTimeout(start_next_page_timer);
    start_next_page_timer = null;
}

function showNotification(txt, id) {
    chrome.runtime.sendMessage({
        showNotification: txt,
        tabId: id
    });
}

function stopLeonard(continueList){
    resetAllIntervals();
    chrome.storage.local.set({
        nextPageRedirect: false
    });
    chrome.runtime.sendMessage({
        removeBadge: true
    });
    $("#start_sending_conn").text("SEND");
    $("#start_sending_conn").removeClass("started");
    $("#start_viewing").text("START");
    $("#start_viewing").removeClass("started");
    if(!continueList){
        currentIdx = 0;
    }
}

function getTodaysDate() {
    return (new Date()).toISOString().substring(0, 10) + " " + (new Date()).toLocaleTimeString();
}

function getNextDateTimeStamp() {
    var d1 = new Date();
    var d2 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate() + 1, 0, 0, 0);
    var secs = (d2 - d1) / (1000);
    var mins = secs / 60;
    var hours = mins / 60;
    var rel_secs = ('0' + (parseInt(secs) % 60)).slice(-2);
    var rel_mins = ('0' + (parseInt(secs / 60) % 60)).slice(-2);
    var rel_hours = ('0' + (parseInt(mins / 60) % 60)).slice(-2);
    if (parseInt(rel_hours) == 0 && parseInt(rel_mins) == 0 && parseInt(rel_secs) < 10) {
        location.reload(true);
    }
    return rel_hours + "h " + rel_mins + "m " + rel_secs + "s";
}

/*
	Scraper methods
*/

function Scraper(url, data) {
    this.profile_url = url;
    this.page_data = data;
    this.attrs = {
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        country: '',
        industry: '',
        websites: '',
        current_companies: '',
        birthday: '',
        twitter_accounts: '',
        viewed_linkedin_profile_url: url
    }
}

Scraper.prototype.scrapeData = function() {
    var that = this;
    if (isSalesNav) {
        try {
            var json_arr = that.page_data.match(/<!--{[\s\S]*?}-->/g);
            var json_filtered_list = [];
            json_arr.forEach(function(ja) {
                ja = ja.replace(/<!--/, '').replace(/-->/, '');
                ja = JSON.parse(ja);
                if (ja.hopscotch) {
                    json_filtered_list.push(ja);
                }
            })
            if (json_filtered_list.length > 0) {
                var profile = json_filtered_list[0].profile;
                that.attrs.firstname = profile.firstName;
                that.attrs.lastname = profile.lastName;
                that.attrs.country = profile.location.match(/[A-Za-z]+/g).slice(-1)[0];
                that.attrs.member_id = profile.memberId;
                that.attrs.industry = profile.industry;
                if (profile.contactInfo) {
                    if (profile.contactInfo.phones) {
                        that.attrs.phone = profile.contactInfo.phones.join(',');
                    }
                    if (profile.contactInfo.emails) {
                        that.attrs.email = profile.contactInfo.emails.join(',');
                    }
                    that.attrs.viewed_linkedin_profile_url = profile.contactInfo.publicProfileUrl;
                    that.attrs.websites = profile.contactInfo.websites && typeof profile.contactInfo.websites == 'object' && profile.contactInfo.websites.length > 0 ? profile.contactInfo.websites.map(x => x[1]).join(',') : '';
                    that.attrs.twitter_accounts = profile.contactInfo.twitterAccounts ? profile.contactInfo.twitterAccounts.join(',') : '';
                }
                var current_companies = [];
                profile.positions.forEach(function(p) {
                    if (p.current) {
                        current_companies.push(p.companyName);
                    }
                })
                that.attrs.current_companies = current_companies.join(',');
                // that.attrs.birthday = profile.firstName;
                $.ajax({ // viewing normal profile
                    url: that.attrs.viewed_linkedin_profile_url,
                    success: function(viewed_resp) {
                        if (typeof that.onScrapeComplete == 'function') {
                            var json_codes = viewed_resp.match(/>\s+{.*}\s+</g);
                            if(json_codes && json_codes.length > 0){
                                json_codes.forEach(function(jc) {
                                    var etosp = jc.replace(/>\s+/, '').replace(/\s+</, '')
                                    try {
                                        var js_obj = JSON.parse($('<textarea />').html(etosp).val());
                                        if (js_obj && js_obj.data && js_obj.data.$type == 'com.linkedin.voyager.identity.profile.ProfileView') {
                                            js_obj.included.forEach(function(j){
                                                if(j.$type == 'com.linkedin.voyager.identity.shared.MiniProfile' && j.objectUrn.indexOf(that.attrs.member_id) > -1){
                                                    that.attrs.publicIdentifier = j.publicIdentifier;
                                                    that.attrs.member_id = j.objectUrn.replace('urn:li:member:','');
                                                    that.attrs.lastname = j.lastName;
                                                }
                                            })
                                        }
                                    } catch (parse_error) {
                                        console.log(parse_error);
                                    }
                                });
                            }
                            that.onScrapeComplete();
                        }
                    },
                    error: function() {
                        if (typeof that.onScrapeComplete == 'function') {
                            that.onScrapeComplete();
                        }
                    },
                    timeout: 5000
                });
            }
        } catch (err) {
            console.log(err);
        }
    } else {
        var json_codes = this.page_data.match(/>\s+{.*}\s+</g);
        if(json_codes && json_codes.length){
            json_codes.forEach(function(jc) {
                var etosp = jc.replace(/>\s+/, '').replace(/\s+</, '')
                try {
                    var js_obj = JSON.parse($('<textarea />').html(etosp).val());
                    if (js_obj && js_obj.data) {
                        if (js_obj.data.address) {
                            // that.attrs.country = js_obj.data.address.split(",").slice(-1)[0].trim();
                            that.attrs.country = js_obj.data.address.match(/[A-Za-z]+/g).slice(-1)[0];
                        }
                        if (js_obj.data.emailAddress) {
                            that.attrs.email = js_obj.data.emailAddress;
                        }
                        if (js_obj.data.phoneNumbers && js_obj.data.phoneNumbers.length > 0) {
                            var filtered_inc = js_obj.included.filter(function(inc) {
                                return inc.number;
                            });
                            if (filtered_inc.length > 0) {
                                that.attrs.phone = filtered_inc[0].number;
                            }
                        }
                        if (js_obj.data.websites && js_obj.data.websites.length > 0) {
                            var filtered_inc = js_obj.included.filter(function(inc) {
                                return inc.url;
                            });
                            if (filtered_inc.length > 0) {
                                that.attrs.websites = filtered_inc[0].url;
                            }
                        }
                        if (js_obj.data.birthDateOn) {
                            var filtered_inc = js_obj.included.filter(function(inc) {
                                if (inc.$id) {
                                    return inc.$id.indexOf('birthDateOn') > 0;
                                }
                            });
                            if (filtered_inc.length > 0) {
                                var dt_str = '';
                                if (filtered_inc[0].month) {
                                    dt_str = filtered_inc[0].month;
                                }
                                if (filtered_inc[0].day) {
                                    if (dt_str) {
                                        dt_str += '-';
                                    }
                                    dt_str += filtered_inc[0].day;
                                }
                                if (filtered_inc[0].year) {
                                    if (dt_str) {
                                        dt_str += '-';
                                    }
                                    dt_str += filtered_inc[0].year;
                                }
                                that.attrs.birthday = dt_str;
                            }
                        }
                        if (js_obj.data.twitterHandles && js_obj.data.twitterHandles.length > 0) {
                            var filtered_inc = js_obj.included.filter(function(inc) {
                                if (inc.$id) {
                                    return inc.$id.indexOf('twitterHandles') > 0;
                                }
                            });
                            if (filtered_inc.length > 0) {
                                that.attrs.twitter_accounts = filtered_inc[0].name;
                            }
                        }
                        if (js_obj.data.patentView && (js_obj.data.$type == 'com.linkedin.voyager.identity.profile.ProfileView' || js_obj.data.$type == 'com.linkedin.voyager.identity.profile.Profile')) {
                            var filtered_inc = js_obj.included.filter(function(inc) {
                                return inc.summary || inc.$type == 'com.linkedin.voyager.identity.profile.ProfileView' || inc.$type == 'com.linkedin.voyager.identity.profile.Profile';
                            });
                            if (filtered_inc.length > 0) {
                                that.attrs.industry = filtered_inc[0].industryName;
                                that.attrs.lastname = filtered_inc[0].lastName;
                                that.attrs.firstname = filtered_inc[0].firstName;
                            }
                            var current_companies = [];
                            if (js_obj.data.organizationView) {
                                var comp_ids = [];
                                var filtered_inc = js_obj.included.filter(function(inc) {
                                    if (inc.$type == 'com.linkedin.common.Date' && inc.$id.match(/urn:li:fs_position:.*?timePeriod,startDate/)) {
                                        comp_ids.push(inc.$id.match(/,\d+\)/)[0].slice(1, -1));
                                        return inc;
                                    }
                                });
                                comp_ids.forEach(function(comp_id) {
                                    var isEnded = false;
                                    js_obj.included.forEach(function(inc) {
                                        if (inc.$id && inc.$id.indexOf(comp_id) > -1 && inc.$id.indexOf('endDate') > -1) {
                                            isEnded = true;
                                        }
                                    })
                                    if (!isEnded) {
                                        js_obj.included.forEach(function(inc) {
                                            if (inc.companyName && inc.company && inc.company.indexOf(comp_id) > -1) {
                                                current_companies.push(inc.companyName);
                                            }
                                        })
                                    }
                                })
                            }
                            that.attrs.current_companies = current_companies;
                        }
                    }
                } catch (parse_error) {
                    console.log(parse_error);
                }
            });
        }
        if (typeof this.onScrapeComplete == 'function') {
            this.onScrapeComplete();
        }
    }
};

function getUserDetails(callback) {
    chrome.storage.local.get("user_details", function(ud) {
        callback(ud['user_details']);
    })
}

function logOutUserFromLeonard() {
    getUserDetails(function(ud) {
        if (ud.rememberMe) {
            ud.autoLogIn = false;
        } else {
            ud = {};
        }
        chrome.storage.local.set({
            "user_details": ud
        });
    })
    chrome.runtime.sendMessage({
        removeBadge: true
    })
}

window.onerror = function() {
    console.log(arguments)
    showNotification("Please check the console\nThere is some error.");
    // location.reload();
}