angular.module('angular-formly-simplified',['formly'])
.factory('AngularFormlySimplified',function (formlyConfig) {

  var AngularFormlySimplified = {};
  formlyConfig.extras.errorExistsAndShouldBeVisibleExpression = '!options.formControl.$valid && (options.formControl.$dirty||options.formControl.$touched)';
  formlyConfig.extras.explicitAsync = true;

  var fieldsHash = {};
  AngularFormlySimplified.defineFields = function (options) {
    if(!_.isPlainObject(options.fields)){throw new Error('defineFields requires {fields:{}}');}

    // set default field properties and populate a fields hash
    var modelKeyArr;
    _.forIn(options.fields,function(field,key){
      if(fieldsHash[key]){throw new Error('field ' + key + 'already defined as: ' + JSON.stringify(fieldsHash[key]) );}
      moveInvalidPropertiesToData(field);
      // set a default field key
      field.key = field.key || key.split('.').slice(-1)[0];
      fieldsHash[key] = field;
    });

  };

  var wrappersHash = {};
  AngularFormlySimplified.defineWrappers = function (wrapperHash) {
    _.forIn(wrapperHash,function (wrapperObj,key) {
      if(wrappersHash[key]){throw new Error('Wrapper ' + key + ' already defined.');}
      wrapperObj.name = key;
      wrappersHash[key] = wrapperObj;
      formlyConfig.setWrapper(wrapperObj);
    });
  };

  AngularFormlySimplified.getFields = function(){
    if (_.isArray(arguments[0])){
      var fields = arguments[0];
      var retFields = [];
      for (var i = 0,L = fields.length; i < L; i++){
        var toMix;
        if(typeof fields[i] === 'string'){
          toMix = _.cloneDeep(fieldsHash[fields[i]]);
        } else {
          toMix = fields[i];
          moveInvalidPropertiesToData(toMix);
        }
        if(toMix.data && toMix.data.aliasFor){
          retFields.push.apply(retFields,AngularFormlySimplified.getFields(toMix.data.aliasFor));
        } else {
          // inherit from defaults and mixins
          _.defaultsDeep.apply(null, getDeps(toMix, toMix.data.defaults.concat(_.ensureArray(fields.defaults))));
          _.merge.apply(null, getDeps(toMix, toMix.data.mixins.concat(_.ensureArray(fields.mixins))));
          retFields.push(toMix);
        }
      }
      if(retFields.length === 1 && retFields[0].key === 'inlineError'){return retFields;}

      return retFields;
    }
    if(arguments.length > 1){
      return AngularFormlySimplified.getFields({fields:Array.prototype.slice.call(arguments)});
    }
    if(typeof arguments[0] === 'string'){
      return AngularFormlySimplified.getFields(Array.prototype.slice.call(arguments));
    }
    throw new Error('unsupported argument to getFields: ' + arguments[0]);
  };

  _.mixin({ensureArray:function(arg){
    return arg === undefined ? [] : (_.isArray(arg) ? arg : [arg]);
  }});

  return AngularFormlySimplified;


  // move + delete mixins/defaults to keep a record since formly treats them as invalid property
  function moveInvalidPropertiesToData(field){
    field.data = field.data || {};
    field.wrapper = _.ensureArray(field.wrapper);
    field.data.mixins = field.data.mixins || _.ensureArray(field.mixins);
    delete field.mixins;
    field.data.defaults = field.data.defaults || _.ensureArray(field.defaults);
    delete field.defaults;
  }

  function getDeps(field,depNamesArray,outputArray){
    var dep, mergeOutputArray = outputArray || [field];
    _.forEach(depNamesArray,function (depName) {
      dep = fieldsHash[depName];
      if(!dep){
        throw new Error('no field exists with key: ' + depName);
      }
      // We should be able to speed this up by merging the
      // dependencies into each field in fieldsHash on the first run
      // then using the merged fields instead of re-merging dependencies
      if(!_.includes(mergeOutputArray,dep)) {
        mergeOutputArray.push(dep);
        _.forEach(dep.wrapper,function (wrapper) {
          if(!_.includes(field.wrapper,wrapper)) {field.wrapper.push(wrapper);}
        });
        if(dep.data.defaults){getDeps(field,dep.data.defaults,mergeOutputArray);}
        if(dep.data.mixins){getDeps(field,dep.data.mixins,mergeOutputArray);}
      }
    });
    return mergeOutputArray;
  }
})
.directive('atForm',['$q','$compile', 'AngularFormlySimplified',function($q, $compile,AngularFormlySimplified) {

  var formlyTpl = $compile('<div class="clear formly-form-wrapper"><formly-form model="model" fields="fields"></formly-form></div>');

  return {
    scope:true,
    compile:function(tElem,tAttrs){
      return {
        post:function(scope,iElem,iAttrs){
          scope.fields = AngularFormlySimplified.getFields(scope.$eval(tAttrs.fields));
          // scope.model = scope.$eval(tAttrs.model);
          scope.modelMirror = mapFieldsToModelStructure(scope.fields,tAttrs.model,[]);
          scope.modelsToSave = {};
          scope.afterFields = [];
          var parentEl = angular.element('<form class="clear" name="attendForm" ng-submit="submitAtForm($event,attendForm);" novalidate></form>');

          var afterScope = scope.$new(false,scope);
          afterScope.fields = scope.afterFields;
          afterScope.model = {};
          var afterForm = formlyTpl(afterScope);

          var formAppended = false;
          // mapModelToMirrorToScope(scope, iElem, scope, scope.modelMirror, tAttrs.model, formlyTpl, scope.modelsToSave, scope.afterFields );
          scope.$watchCollection(tAttrs.model,function (newVal) {
            if(newVal){
              mapModelToMirrorToScope(scope, parentEl, scope.$eval(tAttrs.model), scope.modelMirror[tAttrs.model], scope.modelsToSave, scope.afterFields );
              if(formAppended === false){
                formAppended = true;
                iElem.append(parentEl);
                iElem.append(afterForm);
              }
            }
          });

          scope.submitAtForm = function (e,form) {
            if(form.$invalid){
              return event.preventDefault();
            }

            scope.$emit('atFormsubmission.start');
            return $q.all(_.values(scope.modelsToSave).map(function (model) {
              return model.save();
            }))
            .then(function () {
              scope.$emit('atFormsubmission.success');
            })
            .catch(function (err) {
              scope.$emit('atFormsubmission.error',err);
            });
          };
        }
      };
    }
  };


  function mapFieldsToModelStructure(fieldsArr,key,modelMirror){
    modelMirror[key] = AngularFormlySimplified.getFields(fieldsArr);
    modelMirror[key].$$subKeys = [];
    modelMirror[key].forEach(function (fieldTemplate,i) {
      _.forIn(fieldTemplate.data.subModelFields,function (subFields,subKey) {
        modelMirror[key][subKey] = mapFieldsToModelStructure(subFields,subKey,modelMirror[key]);
        modelMirror[key].$$subKeys.push(subKey);
      });
    });
    return modelMirror;
  }
  // model may be nested{foo:{bar:{baz:{}}}}
  // fields will be flattened:
  // [
  //  {fields:[],model:foo}
  //  {fields:[],model:foo.bar}
  //  {fields:[],model:foo.bar.baz}
  // ]
  // children are inserted:
  //
  // {foo:{bar:{baz:{}}}}
  // fields:[
  // {
  //    key:'foo',
  //    data:{
  //      subModels:{
  //        bar:[{key:'name'},{key:'age'}],
  //        'bar.baz':[{key:'name'},{key:'age'}] // this works too
  //      }
  //    }}
  // ]
  // fields will be flattened:
  // [
  //  {fields:[],model:foo}
  //  {model:foo,key:'bar',fields:[{key:'name'},{key:'age'}]}
  //  {model:foo,key:'bar',fields:[{key:'name'},{key:'age'}]}
  //  {fields:[],model:foo}
  //  {fields:[],model:foo.bar}
  //  {fields:[],model:foo.bar.baz}
  // ]


  function mapModelToMirrorToScope(topScope,topEl,parentModelsArray,parentMirrorArray,modelsToSave,afterFields){

    _.forEach(_.ensureArray(parentModelsArray),function (parentModel) {
      if(parentModel && parentMirrorArray){
        var child = topScope.$new(false,topScope);
        child.model = parentModel;
        modelsToSave[child.$id] = child.model;

        child.$$originalFields = [];
        parentMirrorArray.forEach(function (fieldTemplate) {
          if(fieldTemplate.data.fieldPosition === null){return;}
          var field = angular.copy(fieldTemplate);
          (fieldTemplate.data.fieldPosition === 'after' ? afterFields : child.$$originalFields).push(field);
        });

        var childEl = formlyTpl(child);
        var appended = false;
        var off = child.$watch('model', function (newVal,oldVal) {
          if(newVal){
            if(!appended){
              child.fields = child.$$originalFields.map(function (field) {
                field.model = newVal;
                return field;
              });
              topEl.append(childEl);
            }
          }
        });

        child.$on('$destroy',function(){
          console.log('offing');
          off();
          delete child.fields;
          delete child.model;
          delete modelsToSave[child.$id];
          childEl.remove();
        });

        // recurse through the model;
        _.forEach(parentMirrorArray.$$subKeys,function (subKey) {
          mapModelToMirrorToScope(topScope,topEl,parentModel[subKey],parentMirrorArray[subKey],modelsToSave,afterFields);
        });
      }
    });
  }

}])

.directive('tpl', ['AngularFormlySimplified',function (AngularFormlySimplified) {
  return {
    restrict: 'E',
    replace:true,
    scope:false,
    template:function (tElem,tAttrs) {
      var field = AngularFormlySimplified.getFields([tAttrs.field])[0];
      if(field.template) {return "'" + field.template + "'";}
      if(field.templateUrl) {return '<div ng-include src="\'' + field.templateUrl + '\'"></div>';}
      throw new Error('field does not have a template or templateUrl');
    }
  };
}]);

