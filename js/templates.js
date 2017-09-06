var user_id = false;
$(document).ready(function(){
	$('#addTemplateModal').on('shown.bs.modal', function (e) {
		$('#addTempForm').formValidation('resetForm', true);
	});
	$('.variable').bind('click', function(){
		var tempContent = $('#template-content').val();
		tempContent += ' '+$(this).text();
		$('#template-content').val(tempContent).trigger('input');
	});

	$('#addTempForm').formValidation({
		framework: 'bootstrap',
		icon: {
			valid: 'fa fa-check',
			invalid: 'fa fa-times',
			validating: 'fa fa-refresh'
		},
		fields: {
			'template-name' : {
				row : '.form-group',
				validators : {
					notEmpty : {
						message : 'Template name is required'
					}
				}
			},
			'template-content' : {
				row : '.form-group',
				validators : {
					notEmpty : {
						message : 'Template content is required'
					}
				}
			}
		}
	}).on('success.form.fv', function(e) {
		var templateName = $('#template-name').val();
		var templateContent = $('#template-content').val();
		chrome.runtime.sendMessage({
			saveTemplate : true,
			templateName : templateName,
			templateContent : templateContent
		}, function(){
			location.reload();
		});
	});
	chrome.storage.local.get('user_details', function(ud){
		if(!ud.user_details) return false;
		user_id = ud.user_details.user_id;
		chrome.runtime.sendMessage({
			getTemplates : true
		}, function(templates){
			if(templates && templates.length > 0){
				var HTML =  '<tr>'+
											'<td>{#}</td>'+
											'<td>{name}</td>'+
											'<td>{content}</td>'+
											'<td><i class="fa fa-trash delete-template" data-id="{id}" aria-hidden="true"></i></td>'+
										'</tr>';
				templates.forEach(function(t,i){
					var tr = HTML.slice(0);
					tr = tr.replace('{#}',(i+1)).replace('{id}',t.id).replace('{name}',t.template_name).replace('{content}',t.template_content)
					$("#template_cont tbody").append(tr);
				});
			} else {
				var tr = '<tr><td colspan="5">No templates found</td></tr>';
				$("#template_cont tbody").html(tr);
			}
			$('.delete-template').unbind('click');
			$('.delete-template').bind('click', function(){
				var template_id = $(this).attr('data-id');
				chrome.runtime.sendMessage({removeTemplate:true,template_id:template_id},function(){
					location.reload();
				});
			});
		})
	})
})