_.mixin({ensureArray:function(arg){ // lodash helper
  return arg === undefined ? [] : (_.isArray(arg) ? arg : [arg]);
}});

angular.module('angular-formly-simplified',['formly'])
.factory('AngularFormlySimplified',function (formlyConfig,Helpers) {
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
      if(!field.key && !field.model){
        modelKeyArr = ('model.' + key).split('.');
        field.key = modelKeyArr.pop();
        if(modelKeyArr.length > 1){
          field.model = modelKeyArr.join('.');
        }
        field.data.modelKey = field.key;
        field.data.modelStr = field.model;
      }
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
          _.defaultsDeep.apply(null, getDeps(toMix, toMix.data.defaults.concat(_.ensureArray(fields[i].defaults))));
          _.merge.apply(null, getDeps(toMix, toMix.data.mixins.concat(_.ensureArray(fields[i].mixins))));
          retFields.push(toMix);
        }
      }
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
.directive('atForm',function () {
  return {
    template:'' +
    '<form class="clear" name="attendForm" ng-submit="$broadcast(\'parentFormSubmission\',$event);" novalidate>' +
      '<subform fields="fields" model="model" form="attendForm"></subform>' +
    '</form>',
    scope:{
      fields:'=',
      model:'='
    }
  };
})
.directive('subform', ['$q','$compile', 'AngularFormlySimplified',function($q, $compile,AngularFormlySimplified) {

  var compiledSubtpl = $compile('<div class="clear"><formly-form model="model" fields="fields"></formly-form></div>');
  var parentFns = {};

  return {
    restrict: 'E',
    require:'^form',
    // scope:true,
    link:function (scope,iElem,iAttrs,formControl) {
      var modelsToSave = [];
      // $scope.formState;

      // scope.fields = AngularFormlySimplified.getFields(scope.parentFields);

      scope.$watch('model',function (newVal,oldVal,scope) {
        if(newVal){
          // debugger;
          compileFields(scope.$parent, iElem, newVal, scope.fields);
        }
      });

      scope.$on('parentFormSubmission',function (e,$event) {
        if(scope.form.$invalid){
          return event.preventDefault();
        }

        scope.$emit('atFormsubmission.start');
        return $q.all(modelsToSave.map(function (model) {
          return model.save();
        }))
        .then(function () {
          scope.$emit('atFormsubmission.success');
        })
        .catch(function (err) {
          scope.$emit('atFormsubmission.error',err);
        });
      });

      scope.$on('modelsToSave',function (event,modelsArray) {
        event.preventDefault();
        modelsArray.forEach(function (model) {
          if(!_.includes(modelsToSave,model)){
            modelsToSave.push(model);
          }
        });
        console.log('modelsToSave',modelsArray);
      });

      var idx;
      scope.$on('modelsToDestroy',function (event,modelsArray) {
        event.preventDefault();
        modelsArray.forEach(function (model) {
          idx = modelsToSave.indexOf(model);
          if(idx > -1){
            modelsToSave.splice(idx,1);
          }
        });
        console.log('modelsToDestroy',modelsArray);
      });
    }
  };

  function compileFields(scope, $el, model, fieldsObj) {
    var modelsArray = _.ensureArray(model);
    var fObj = _.isArray(fieldsObj) ? {fields:fieldsObj} : fieldsObj;

    var children = [];
    scope.$watchCollection(
      function(){return modelsArray;},
      function (newVal,oldVal,scope) {
        console.log('newVal,oldVal',newVal,oldVal);

        if(newVal){
          if(fObj.preForm){
            compileFields(scope, $el, model, {prepend:true,fields:fObj.preForm});
          }

          _.forEach(newVal,function (childModel,i) {
            // if(_.isArray(model)){
            var child = scope.$new(false,scope);
            child.fields = [];
            child.fields = AngularFormlySimplified.getFields(fObj.fields);
            console.log('child.fields',child.fields);
            child.model = childModel;
            child.form = scope.form;
            child.fns = scope.fns;
            _.forEach(child.fields,function (fld) {
              if(_.isArray(model)){
                fld.data.parentCollection = model;
              }
              fld.model = childModel;
            });

            children.push(child);
            var childEl = compiledSubtpl(child);

            // recursively create subModels/fields in field.data.subModels
            _.forEach(child.fields,function (cfld) {
              if(!cfld.data || !cfld.data.subModels) {return;}
              _.forIn(cfld.data.subModels,function (subFields,modelKey) {
                if(child.model[modelKey]){
                  compileFields(child, childEl, child.model[modelKey], {fields:subFields});
                }
              });
            });

            if(fObj.prepend){
              $el.prepend(childEl);
            } else {
              $el.append(childEl);
            }
          });
          if(fObj.afterForm){
            compileFields(scope, $el, model, {fields:fObj.afterForm});
          }
          scope.$emit('modelsToSave',newVal);
        }
      }
    );

    scope.$on('$destroy',function () {
      scope.$emit('modelsToDestroy',_.pluck(children,'model'));
      _.forEach(children,function (child) {
        child.$destroy();
      });
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

