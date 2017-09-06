var trial_comp = false;
var triggered_prog = false;
var LINKEDIN_SEARCH_PAGE = 'https://www.linkedin.com/search/results/index/';
var local_data = {};
var ONE_DAY = 24*60*60*1000;
var MAX_VIEWS = 500;
var user_id = '';

$(document).ready(function(){
    $("#top_version").text(chrome.runtime.getManifest().version);
    chrome.storage.local.get("isUserInvisible",function(obj){
        $("#login_popup").show();
        $("#det_popup").hide();
        chrome.storage.local.get("user_details",function(user_obj){
            var ud = user_obj["user_details"];
            if(ud && user_obj["user_details"]['autoLogIn']){
                $("#login_popup").hide();
                $("#det_popup").show();
                var firstname = user_obj["user_details"]['firstname'];
                $("#greet_user").text("Hi "+firstname+",")
                // $("#logged_in_email").text(user_obj["user_details"]['email']);
                showTimer(user_obj);
                setLocalValues();
            } else {
                if(ud && ud.rememberMe){
                    $("#l_email").val(ud.email);
                    $("#l_password").val(ud.password);
                    $("#remember_me").prop("checked",ud.rememberMe);
                }
                $("#login_form").validate({
                    rules : {
                        l_email : {
                            email : true,
                            required : true
                        },
                        l_password : {
                            minlength : 5,
                            required : true
                        }
                    }
                });
                $("#login_form").on("submit",function(){
                    if($("label.error:visible").length > 0){
                        return false;
                    }
                    $("#sign_in_btn").val("Signing in...");
                    $("#sign_in_btn").attr("disabled",true);
                    removeErrorMsg();
                    var email = $("#l_email").val();
                    var password = $("#l_password").val();
                    var rememberMe = $("#remember_me").is(":checked");
                    chrome.runtime.sendMessage({email:email,password:password,rememberMe:rememberMe},function(resp){
                        if(resp == "success"){
                            location.reload();
                        } else {
                            $("#l_email").val("");
                            $("#l_password").val("");
                            $("#sign_in_btn").val("Sign In");
                            $("#sign_in_btn").removeAttr("disabled");
                            $("#l_email").trigger("focus");
                            showErrorMsg("Email / password is incorrect, please enter again.", 'login_popup');
                        }
                    });
                    return false;
                })

                $("#sign_up_form").validate({
                    rules : {
                        name : {
                            required : true
                        },
                        email : {
                            email : true,
                            required : true
                        },
                        password : {
                            minlength : 5,
                            required : true
                        },
                        confirmPass : {
                            minlength : 5,
                            required : true,
                            equalTo : '#password'
                        }
                    }
                });
                $("#sign_up_form").on("submit",function(){
                    if($("label.error:visible").length > 0){
                        return false;
                    }
                    $("#sign_up_btn").val("Signing up...");
                    $("#sign_up_btn").attr("disabled",true);
                    removeErrorMsg();
                    var firstname = $("#firstname").val();
                    var email = $("#email").val();
                    var password = $("#password").val();
                    chrome.runtime.sendMessage({register: true, firstname:firstname, email:email, password:password},function(resp){
                        if(resp.createdAt){
                            showNotification("You are successfully registered with Leonard service!");
                            location.reload();
                        } else {
                            // $("#firstname").val("");
                            // $("#email").val("");
                            // $("#password").val("");
                            // $("#confirmPass").val("");
                            $("#sign_up_btn").val("Sign Up");
                            $("#sign_up_btn").removeAttr("disabled");
                            showErrorMsg("Please enter valid details", 'sign_up_popup');
                            showNotification(resp.responseJSON.details.split("\n")[2].trim());
                        }
                    });
                    return false;
                })
            }
        })
    })
    $("#who_viewed").bind("click",function(){
        chrome.tabs.create({url : 'https://www.linkedin.com/wvmx/profile'});
    })
    $(".font-btn, #view_all_profiles").bind("click",function(){
        chrome.tabs.create({url : LINKEDIN_SEARCH_PAGE});
    })
    $(".close_btn").bind("click",function(){
        window.close();
    });
    $("#start_stop").bind("click",function(){
        chrome.runtime.sendMessage({start_stop:true});
    });
    $("#open_sales_nav").bind("click",function(){
        chrome.tabs.create({url : 'https://www.linkedin.com/sales/search'});
    });
    $("#open_crm").bind("click",function(){
        chrome.tabs.create({url : chrome.runtime.getURL('CRM/index.html')});
    });
    $("#export_data").bind("click",function(){
        chrome.storage.local.get("user_details",function(o){
            var user_id = o.user_details.id;
            view_info = 'view_info_'+user_id;
            chrome.storage.local.get(view_info,function(obj){
                var user_details = obj[view_info] || [];
                // var csv_data = "First Name,Last Name,TITLE,EMAILS,PHONES,COUNTRY,INDUSTRY,WEBSITES,CURRENT_COMPANIES,PAST_COMPANIES,BIRTHDAY,SKILLS,CERTIFICATIONS,LANGUAGES,TWITTER_ACCOUNTS,LINKEDIN_URL\r\n";
                var csv_data = "First Name,Last Name,EMAIL,PHONE,COUNTRY,INDUSTRY,WEBSITES,CURRENT_COMPANIES,BIRTHDAY,TWITTER_ACCOUNTS,LINKEDIN_URL\r\n";
                user_details.forEach(function(user){
                    csv_data += '"'+user['First Name']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['Last Name']+'"';
                    csv_data += ",";
                    // csv_data += '"'+user['TITLE']+'"';
                    // csv_data += ",";
                    csv_data += '"'+user['EMAILS']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['PHONES']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['COUNTRY']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['INDUSTRY']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['WEBSITES']+'"';
                    csv_data += ",";
                    csv_data += '"'+user['CURRENT_COMPANIES']+'"';
                    csv_data += ",";
                    // csv_data += user['PAST_COMPANIES'];
                    // csv_data += ",";
                    csv_data += user['BIRTHDAY'];
                    csv_data += ",";
                    // csv_data += '"'+user['SKILLS']+'"';
                    // csv_data += ",";
                    // csv_data += '"'+user['CERTIFICATIONS']+'"';
                    // csv_data += ",";
                    // csv_data += '"'+user['LANGUAGES']+'"';
                    // csv_data += ",";
                    csv_data += '"'+user['TWITTER_ACCOUNTS']+'"';
                    csv_data += ",";
                    csv_data += user['LINKEDIN_URL'];
                    csv_data += "\r\n";
                });
                var fileName = "Leonard_profiles_"+getTodaysDate();
                var uri = 'data:text/csv;charset=utf-8,' + escape(csv_data);
                var link = document.createElement("a");
                link.href = uri;
                link.style = "visibility:hidden";
                link.download = fileName + ".csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        });
    })
    $("#logout").bind("click",function(){
        getUserDetails(function(user_details){
            if(user_details.rememberMe){
                user_details.autoLogIn = false;
            } else {
                user_details = {};
            }
            chrome.storage.local.set({"user_details":user_details});
        })
        // chrome.storage.local.set({"user_details":""})
        chrome.runtime.sendMessage({
            reloadPage : true
        });
        chrome.runtime.sendMessage({
            removeBadge : true
        })
        location.reload();
    })
    $("#ln_search").bind("keyup",function(e){
        if(e.keyCode == 13){
            var ln_search_val = $(this).val();
            if(ln_search_val){
                var search_url = 'https://www.linkedin.com/vsearch/f?type=all&keywords='+escape(ln_search_val);
                chrome.tabs.create({
                    url : search_url
                });
                return false;
            } else {
                showErrorMsg("Please enter search query!",'det_popup');
            }
        } else {
            removeErrorMsg();
        }
    })
    $("#sign_up_anc").bind("click",function(){
        $("#login_popup").hide();
        $("#det_popup").hide();
        $("#sign_up_popup").show();
    })
    // today_bar = new createProgressBar("today");
    // last_week_bar = new createProgressBar("last_week");
    // this_month_bar = new createProgressBar("this_month");
    // skipped_today_bar = new createProgressBar("skipped_today");
    // skipped_last_week_bar = new createProgressBar("skipped_last_week");
    // skipped_this_month_bar = new createProgressBar("skipped_this_month");
});

function showErrorMsg(txt, id){
    $("#"+id+" .error_msg").text(txt).show();
}

function removeErrorMsg(){
    $(".error_msg").text('').hide();
}

function millisecondsToStr(milliseconds) {
    function numberEnding (number) {
        return (number > 1) ? 's' : '';
    }
    var temp = Math.floor(milliseconds / 1000);
    var years = Math.floor(temp / 31536000);
    if (years) {
        return years + ' year' + numberEnding(years);
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        return days + ' day' + numberEnding(days);
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        return hours + ' hour' + numberEnding(hours);
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        return minutes + ' minute' + numberEnding(minutes);
    }
    var seconds = temp % 60;
    if (seconds) {
        return seconds + ' second' + numberEnding(seconds);
    }
    return 'less than a second';
}

var trialInterval = setInterval(function(){
    chrome.storage.local.get("user_details",function(user_obj){
        if(user_obj['user_details']){
            showTimer(user_obj);
        }
    });
    setLocalValues();
},1000);

function trialExpired(){
    trial_comp = true;
    $(".trial_text").addClass('error');
    $(".last_center_msg").text("Your trial expired!");
    $("#trial").text('');
    $("#ghost_mode").attr("disabled","true");
    chrome.runtime.sendMessage({
        setUserVisibility : false
    })
}

function showTimer(user_obj){
    var rem_time_mill_secs = (user_obj["user_details"]['expire_time']-Date.now());
    $(".trial_text").show();
    if(rem_time_mill_secs < 0){
        clearInterval(trialInterval);
        trialExpired();
        return false;
    }
    var trial_rem = millisecondsToStr(rem_time_mill_secs);
    $("#trial").text(trial_rem);
}

function setLocalValues(){
    chrome.storage.local.get('user_details',function(o){
        if(o.user_details){
            user_id = o.user_details.id;
            linkedin_data = 'LINKEDIN_DATA_'+user_id;
            view_info = 'view_info_'+user_id;
            chrome.storage.local.get(linkedin_data,function(obj){
                if(obj[linkedin_data]){
                    local_data = obj[linkedin_data];
                    var month_ago_timestamp = Date.now()-(local_data.month_active*ONE_DAY);
                    var week_ago_timestamp = Date.now()-(local_data.week_active*ONE_DAY);
                    var today_views = Date.now()-(ONE_DAY);
                    var deletable_indices = [];
                    var visited_today = 0;
                    var skipped_today = 0;
                    var visited_in_week = 0;
                    var skipped_in_week = 0;
                    local_data.views.forEach(function(view,idx){
                        if(view.viewed_at > week_ago_timestamp){
                            visited_in_week++;
                            skipped_in_week += view.skipped;
                        }
                        if(view.viewed_at < month_ago_timestamp){
                            deletable_indices.push(idx);
                        }
                        if(view.viewed_at > today_views){
                            visited_today++;
                            skipped_today += view.skipped;
                        }
                    });
                    local_data.VISITED = visited_today;
                    local_data.SKIPPED = skipped_today;
                    local_data.VISITED_IN_WEEK = visited_in_week;
                    local_data.SKIPPED_IN_WEEK = skipped_in_week;
                    deletable_indices.forEach(function(idx){
                        local_data.views.splice(idx,1);
                    });
                    var total_visited = local_data.views.length;
                    var total_skipped = 0;
                    local_data.views.forEach(function(view){
                        total_skipped += view.skipped;
                    });
                    local_data.TOTAL_VISITED = total_visited;
                    local_data.TOTAL_SKIPPED = total_skipped;
                } else {
                    $("#today_visited_out_of_remaining").text(0+"/"+MAX_VIEWS);
                    $("#today_skipped").text(0);
                    $("#total_remaining").text(MAX_VIEWS);
                    $("#visited_in_week").text(0);
                    $("#skipped_in_week").text(0);
                    $("#last_thirty_visited").text(0);
                    $("#last_thirty_skipped").text(0);
                }
            });
        }
    });
}

function getUserDetails(callback){
    chrome.storage.local.get("user_details", function(ud){
        callback(ud['user_details']);
    })
}

setInterval(function(){
    chrome.runtime.sendMessage({
        getRunning : true
    },function(res){
        if(res){
            $("#start_stop").text('STOP LEONARD');
            $("#start_stop_desc").text('Stop Leonard to view profiles.')
        } else {
            $("#start_stop").text('START LEONARD');
            $("#start_stop_desc").text('Start Leonard to view profiles.')
        }
    })
},50);

function showNotification(txt, id){
    chrome.runtime.sendMessage({showNotification : txt, tabId : id});
}

function getTodaysDate(){
    return (new Date()).toISOString().substring(0,10) +" "+ (new Date()).toLocaleTimeString();
}

function createProgressBar(cont_id){
    var cont = $("#"+cont_id)[0];
    var that = this;
    that.visited = 0;
    var bar = new ProgressBar.SemiCircle(cont, {
        color: '#000',
        strokeWidth: 3,
        trailWidth: 3,
        easing: 'easeInOut',
        duration: 500,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#000', width: 3 },
        to: { color: '#000', width: 3 },
        step: function(state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);
            var value = Math.round(circle.value() * 100);
            circle.setText(that.visited);
        }
    });
    bar.text.style.fontFamily = '"Raleway", Helvetica, sans-serif';
    bar.text.style.fontSize = '25px';
    this.bar = bar;
}

createProgressBar.prototype.animate = function(val){
    this.visited = val;
    this.bar.animate(this.visited/1000);
}