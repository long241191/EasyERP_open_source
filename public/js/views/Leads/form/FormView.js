define([
    'Backbone',
    'Underscore',
    'jQuery',
    'text!templates/Leads/form/FormTemplate.html',
    'text!templates/Leads/workflowProgress.html',
    'text!templates/Leads/aboutTemplate.html',
    'views/Editor/NoteView',
    'views/Editor/AttachView',
    'views/Companies/formPropertyView',
    'views/Persons/formProperty/formPropertyView',
    'views/Tags/TagView',
    'constants',
    'dataService',
    'views/selectView/selectView',
    'populate'
], function (Backbone, _, $, OpportunitiesFormTemplate, workflowProgress,aboutTemplate, EditorView, AttachView, CompanyFormProperty, ContactFormProperty, TagView, constants, dataService, SelectView, populate) {
    'use strict';

    var FormOpportunitiesView = Backbone.View.extend({
        el: '#content-holder',

        initialize: function (options) {
            this.formModel = options.model;
            this.formModel.urlRoot = constants.URLS.LEADS;
            this.formModel.on('change:tags', this.saveTags, this);
            _.bindAll(this, 'saveDeal');
            this.responseObj = {};
            this.modelChanged = {};
        },

        events: {
            click                                              : 'hideNewSelect',
            'click #tabList a'                                 : 'switchTab',
            'keyup .editable'                                  : 'setChangeValueToModel',
            'click #cancelBtn'                                 : 'cancelChanges',
            'click #saveBtn'                                   : 'saveChanges',
            'click .tabListItem'                               : 'changeWorkflow',
            'click .current-selected:not(.jobs)'               : 'showNewSelect',
            'click .newSelectList li:not(.miniStylePagination)': 'chooseOption',
            'click #convertToOpportunity'                      : 'convertToOpp'
        },

        hideNewSelect: function () {
            this.$el.find('.newSelectList').hide();

            if (this.selectView) {
                this.selectView.remove();
            }
        },

        convertToOpp : function (e){
            e.preventDefault();
            this.saveDeal({
                isOpportunitie : true,
                isConverted    : true,
                convertedDate  : new Date()
            }, 'converted');
        },

        setChangeValueToModel: function (e) {
            var $target = $(e.target);
            var property = $target.attr('data-id').replace('_', '.');
            var value = $target.val();

            this.modelChanged[property] = value;
            this.showButtons();
        },

        showButtons: function () {
            this.$el.find('#formBtnBlock').addClass('showButtons');
        },

        hideButtons: function () {
            this.$el.find('#formBtnBlock').removeClass('showButtons');
        },

        saveChanges: function (e) {
            e.preventDefault();
            this.saveDeal(this.modelChanged);
        },

        cancelChanges: function (e) {
            e.preventDefault();
            this.modelChanged = {};
            this.renderAbout();
        },

        showNewSelect: function (e) {
            var $target = $(e.target);

            e.stopPropagation();

            if ($target.attr('id') === 'selectInput') {
                return false;
            }

            if (this.selectView) {
                this.selectView.remove();
            }

            this.selectView = new SelectView({
                e          : e,
                responseObj: this.responseObj
            });

            $target.append(this.selectView.render().el);

            return false;
        },

        changeWorkflow: function (e) {
            var $target = $(e.target);
            var $thisEl = this.$el;
            var wId;
            var $tabs = $thisEl.find('#workflowProgress .tabListItem');

            if (!$target.hasClass('tabListItem')) {
                $target = $target.closest('div');
            }
            wId = $target.find('span').attr('data-id');
            $tabs.removeClass('passed');
            $tabs.removeClass('active');
            $target.prevAll().addClass('passed');
            $target.addClass('active');
            this.saveDeal({workflow: wId});
        },

        chooseOption: function (e) {
            var $target = $(e.target);
            var holder = $target.parents('.inputBox').find('.current-selected');
            var type = $target.closest('a').attr('data-id');
            var text = $target.text();
            var id = $target.attr('id');

            holder.text(text);

            this.modelChanged[type] = id;

            if (type === 'salesPerson') {
                this.$el.find('#assignedToDd').text(text).attr('data-id', id);
            }
            this.showButtons();
        },

        saveDeal: function (changedAttrs, type) {
            var $thisEl = this.$el;
            var self = this;
            var changedAttributesForEvent = ['name', 'source', 'salesPerson', 'workflow'];
            var changedListAttr = _.intersection(Object.keys(changedAttrs), changedAttributesForEvent);
            var sendEvent = !!(changedListAttr.length);

            this.formModel.save(changedAttrs, {
                patch  : true,
                success: function () {
                    if (type === 'formProperty') {
                        Backbone.history.fragment = '';
                        Backbone.history.navigate(window.location.hash, {trigger: true});
                    } else if (type === 'tags') {
                        self.renderTags();
                    } else if (type === 'converted') {
                        Backbone.history.fragment = '';
                        Backbone.history.navigate('easyErp/Opportunities', {trigger: true});
                    } else {
                        self.editorView.renderTimeline();
                        self.modelChanged = {};
                        self.hideButtons();

                        if (sendEvent){

                            if (changedAttrs.hasOwnProperty('salesPerson')) {
                                changedAttrs.salesPerson = $thisEl.find('#salesPersonDd').text().trim();
                            }

                            if (changedAttrs.hasOwnProperty('source')) {
                                changedAttrs.source = $thisEl.find('#sourceDd').text().trim();
                            }

                            if(changedAttrs.hasOwnProperty('workflow')) {
                                changedAttrs.workflow = $thisEl.find('.tabListItem.active span').text().trim();
                            }

                            self.trigger('itemChanged', changedAttrs);
                        }
                    }
                },
                error  : function (model, response) {
                    if (response) {
                        App.render({
                            type   : 'error',
                            message: response.error
                        });
                    }
                }
            });
        },

        saveTags: function () {
            this.saveDeal(this.formModel.changed, 'tags');
        },

        renderTags: function () {
            var notDiv = this.$el.find('.tags-container');
            notDiv.empty();

            notDiv.append(
                new TagView({
                    model      : this.formModel,
                    contentType: 'Opportunities'
                }).render().el
            );
        },

        deleteItems: function () {
            var mid = 39;

            this.formModel.destroy({
                headers: {
                    mid: mid
                },
                success: function () {
                    Backbone.history.navigate('#easyErp/Opportunities/kanban', {trigger: true});
                }
            });

        },

        renderAbout : function (){
            var self = this;
            var $thisEl = this.$el;
            $thisEl.find('.aboutHolder').html(_.template(aboutTemplate, this.formModel.toJSON()));
            this.renderTags();
            $thisEl.find('#expectedClosing').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true,
                onSelect   : function (dateText) {
                    self.modelChanged['expectedClosing'] = new Date(dateText);
                    self.showButtons();
                }

            });
        },

        render: function () {
            var formModel = this.formModel.toJSON();
            var self = this;
            var $thisEl = this.$el;

            $thisEl.html(_.template(OpportunitiesFormTemplate, formModel));

            dataService.getData('/workflows/', {id: 'Leads'}, function (response) {
                self.responseObj = {workflows: response.data};
                $thisEl.find('#workflowProgress').append(_.template(workflowProgress, {
                    workflows: self.responseObj.workflows,
                    workflow : formModel.workflow
                }));
            });

            dataService.getData('/employees/getForDD', {isEmployee: true}, function (employees) {
                employees = _.map(employees.data, function (employee) {
                    employee.name = employee.name.first + ' ' + employee.name.last;

                    return employee;
                });

                self.responseObj['#salesPersonDd'] = employees;
            });

            this.formProperty = new CompanyFormProperty({
                data       : formModel.company,
                saveDeal   : self.saveDeal,
                isLead     : true
            });

            this.renderTags();

            $thisEl.find('#companyHolder').html(
                this.formProperty.render().el
            );

            $thisEl.find('#contactHolder').html(
                new ContactFormProperty({
                    data       : formModel.customer,
                    saveDeal   : self.saveDeal,
                    isLead     : true
                }).render().el
            );

            this.editorView = new EditorView({
                model      : this.formModel,
                contentType: 'opportunities'
            });

            $thisEl.find('.notes').append(
                this.editorView.render().el
            );

            $thisEl.find('#expectedClosing').datepicker({
                dateFormat : 'd M, yy',
                changeMonth: true,
                changeYear : true,
                onSelect   : function (dateText) {
                    self.modelChanged['expectedClosing'] = new Date(dateText);
                    self.showButtons();
                }

            });
            populate.get('#sourceDd', '/employees/sources', {}, 'name', this);

            $thisEl.find('.attachments').append(
                new AttachView({
                    model      : this.formModel,
                    contentType: 'opportunities'
                }).render().el
            );

            return this;
        }
    });

    return FormOpportunitiesView;
});
