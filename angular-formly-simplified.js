angular.module('angular-formly-simplified',['formly'])
.factory('AngularFormlySimplified',function (formlyConfig) {
  var AngularFormlySimplified = {};
  formlyConfig.extras.errorExistsAndShouldBeVisibleExpression = '!options.formControl.$valid && (options.formControl.$dirty||options.formControl.$touched)';
  formlyConfig.extras.explicitAsync = true;

  var fieldsHash = {};
  // AngularFormlySimplified.defineFields
  // examples:
  //
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


  // I'd like to see fields just be able to wrap other fields.  Using wrappers
  // for now since they work.
  var wrappersHash = {};
  AngularFormlySimplified.defineWrappers = function (wrapperHash) {
    _.forIn(wrapperHash,function (wrapperObj,key) {
      if(wrappersHash[key]){throw new Error('Wrapper ' + key + ' already defined.');}
      wrapperObj.name = key;
      wrappersHash[key] = wrapperObj;
      formlyConfig.setWrapper(wrapperObj);
    });
  };

  // AngularFormlySimplified.getFields
  // examples:
  //    AngularFormlySimplified.getFields('field1','field2','field3');
  //
  //    AngularFormlySimplified.getFields(
  //      {template:'<div>Foo</div>'},
  //      'field2',
  //      {template:'<div>Bar</div>'}
  //    );
  //
  //    AngularFormlySimplified.getFields({
  //      fields:['field1','field2','field3'],
  //      defaults:[
  //        'field4',
  //        'field5'
  //      ],
  //      mixins:[
  //        'fieldWithWrapper1',
  //        {wrapper:'<div><formly-transclude></formly-transclude></div>'}
  //      ],
  //    });
  //
  AngularFormlySimplified.getFields = function(options){
    var opts = options && options.fields ? options : {fields:arguments};
    return _.map(opts.fields,function (arg) {
      var toMix;
      if(typeof arg === 'string'){
        toMix = _.cloneDeep(fieldsHash[arg]);
      } else {
        toMix = arg;
        moveInvalidPropertiesToData(toMix);
      }
      // inherit from defaults and mixins
      _.defaultsDeep.apply(null, getDeps(toMix, toMix.data.defaults.concat(_.ensureArray(opts.defaults))));
      _.merge.apply(null, getDeps(toMix, toMix.data.mixins.concat(_.ensureArray(opts.mixins))));
      return toMix;
    });

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


.directive('atForm', ['$q',function($q) {
  return {
    restrict: 'E',
    template: '<form name="attendForm" ng-submit="submitForm($event);" novalidate>' +
      '<div ng-if="modelsArray.length">' +
        '<div ng-repeat="mdl in modelsArray track by $index" ng-init="fieldsArrays[$index] = copyFields(mdl);">' +
          '<formly-form model="mdl" fields="fieldsArrays[$index]"></formly-form>' +
        '</div>' +
      '</div>' +
    '</form>',
    scope:{
      fields:'=',
      model:'='
    },
    controller:function ($scope) {

      $scope.fieldsArrays = [];
      $scope.modelsArray = _.ensureArray($scope.model);

      $scope.copyFields = function (model) {
        return $scope.fields.map(function (field) {
          var newField = _.transform(field,function(result,val,key){
            if(key === 'model'){
              result.model = model;
              return result;
            }
            result[key] = _.cloneDeep(val);
            return result;
          });
          return newField;
        });
      };

      $scope.submitForm = function (event) {
        /*eslint-disable*/
        debugger;
        /*eslint-enable*/
        if($scope.attendForm.$invalid){
          return event.preventDefault();
        }

        // publish an event controllers can listen for
        $scope.$emit('atFormsubmission.start');
        return $q.all($scope.modelsArray.map(function (model) {
          return model.save();
        }))
        .then(function () {
          $scope.$emit('atFormsubmission.success');
        })
        .catch(function () {
          $scope.$emit('atFormsubmission.error');
        });
      };
    }
  };
}])

.directive('tpl', ['AngularFormlySimplified',function (AngularFormlySimplified) {
  return {
    restrict: 'E',
    replace:true,
    scope:false,
    template:function (tElem,tAttrs) {
      var field = AngularFormlySimplified.getFields(tAttrs.field)[0];
      if(field.template) {return "'" + field.template + "'";}
      if(field.templateUrl) {return '<div ng-include src="\'' + field.templateUrl + '\'"></div>';}
      throw new Error('field does not have a template or templateUrl');
    }
  };
}]);
