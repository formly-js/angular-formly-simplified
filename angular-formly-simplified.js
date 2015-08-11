// for now, requires lodash 3.10
//
//
// Usage:
//
//  ... in factory/service/wherever
//
//  AngularFormlySimplified.defineFields({
//    fields:{
//      text:{
//        template: '<input class="form-control" ng-model="model[options.key]">',
//        templateOptions:{
//          type:'text'
//        }
//      },
//      textarea:{
//        template: '<textarea class="form-control" ng-model="model[options.key]"></textarea>'
//      },
//      number:{
//        defaults:['text'],
//        templateOptions:{
//          type:'number'
//        }
//      },
//      email:{
//        defaults:['text'],
//        templateOptions: {
//          label: 'Email',
//          type: 'email',
//          maxlength: 20,
//          minlength: 4,
//          placeholder: 'example@example.com'
//        }
//      },
//      submitButton:{
//        template:'<button type="submit" ng-disabled="form.$invalid" class="btn btn-success">{{to.text}}</button>',
//        templateOptions:{text:'Submit'}
//      },
//      otherButton:{
//        template:'<button type="button" class="btn btn-success">{{to.text}}</button>',
//        templateOptions:{text:'DoSomething'}
//      },
//    }
//  });
//
//  .. define validators somewhere else
//  AngularFormlySimplified.defineFields({
//    fields:{
//      'validators.required':{
//        templateOptions:{
//          required:true
//        }
//      }
//    }
//  });
//
//  .. define fields specific to your models somewhere else
//  AngularFormlySimplified.defineFields({
//    fields:{
//      'dog.bark':{
//        defaults:['otherButton'],
//        templateOptions:{
//          onClick:function(){
//            console.log('woof');
//          }
//        }
//      },
//      'dog.name':{
//        defaults:['text','validators.required']
//      },
//      'dog.color':{
//        defaults:['text']
//      },
//      'dog.runAwayButton':{
//        defaults:['submitButton'],
//        templateOptions:{
//          text:'Flee!'
//        }
//      }
//    }
//  });
//
//
//
//
//
//
//
//
//  .. in controller (models)
//  var model = {
//    save:function(){var dfd = $q.defer();dfd.resolve();return dfd.promise;}
//  };
//
//  $scope.model = model;
//
//  ..or.. (supports limited models arrays by default)
//
//  $scope.model = [
//    angular.copy(model),
//    angular.copy(model)
//  ];
//
//
//  .. in controller (fields)
//
//  $scope.fields = AngularFormlySimplified.getFields(
//    'dog.name',
//    'dog.color',
//    'dog.bark',
//    'dog.runAwayButton'
//  );
//
//  ..or..
//
//  $scope.fields = AngularFormlySimplified.getFields(
//    {template:'<div>Foo</div>'},
//    'dog.name',
//    {template:'<div>Bar</div>'},
//    'dog.runAwayButton'
//  );
//
//  ..or..
//
//  $scope.fields = AngularFormlySimplified.getFields({
//    fields:['dog.name','dog.color',{defaults:['text']}],
//    defaults:[
//      'validators.required'
//    ],
//    mixins:[
//      {wrapper:'<div>wrapped-><formly-transclude></formly-transclude><-wrapped</div>'}
//    ],
//  });
//
//  ..or..
//
//  $scope.fields = AngularFormlySimplified.getFields(
//    {mixins:['email'],templateOptions:{required:true}}
//  );
//
//  ..same as..
//  $scope.fields = AngularFormlySimplified.getFields(
//    {mixins:['email','validators.required']}
//  );
//
//
//
//
//
//
//  .. in HTML
//
//  <at-form fields="fields" model="model"></at-form>
//
//
//  tbd:
//    - actually put some thought into models arrays support
//      (unless formly has it by the time we need it)
//    - decide how to mix in functions like controller, onChange, and link
//    - consider named child fields in templates, similar to named views in ui-router
//      e.g., {template:'<tpl field="to.subs.a"></tpl>stuff<tpl field="to.subs.b"></tpl>'}


_.mixin({ensureArray:function(arg){ // lodash helper
  return arg === undefined ? [] : (_.isArray(arg) ? arg : [arg]);
}});

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
