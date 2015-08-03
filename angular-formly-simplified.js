// requires formly, and for now, lodash.

angular.module('angular-formly-simplified',['formly'])
.factory('AttendFormlyUtils',function (formlyConfig,Helpers) {
  var AttendFormlyUtils = {};
  formlyConfig.extras.errorExistsAndShouldBeVisibleExpression = '!options.formControl.$valid && (options.formControl.$dirty||options.formControl.$touched)';
  formlyConfig.extras.explicitAsync = true;
  var fieldsHash = {};


  AttendFormlyUtils.defineFields = function (options) {
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
  AttendFormlyUtils.defineWrappers = function (wrapperHash) {
    _.forIn(wrapperHash,function (wrapperObj,key) {
      if(wrappersHash[key]){throw new Error('Wrapper ' + key + ' already defined.');}
      wrapperObj.name = key;
      wrappersHash[key] = wrapperObj;
      formlyConfig.setWrapper(wrapperObj);
    });
  };

  AttendFormlyUtils.getFields = function(){
    return _.map(arguments,function (arg) {
      var toMix;
      if(typeof arg === 'string'){
        toMix = _.cloneDeep(fieldsHash[arg]);
      } else {
        toMix = arg;
        moveInvalidPropertiesToData(toMix);
      }
      // inherit from defaults and mixins
      _.defaultsDeep.apply(null,getDeps(toMix,toMix.data.defaults));
      _.merge.apply(null,getDeps(toMix,toMix.data.mixins));
      return toMix;
    });
  };

  return AttendFormlyUtils;


  // move + delete mixins/defaults to keep a record since formly treats them as invalid property
  function moveInvalidPropertiesToData(field){
    field.data = field.data || {};
    field.wrapper = _.ensureArray(field.wrapper);
    field.data.mixins = field.data.mixins || _.ensureArray(field.mixins);
    delete field.mixins;
    field.data.defaults = field.data.defaults || _.ensureArray(field.defaults);
    delete field.defaults;
  }

  function getDeps(field, depNamesArray, optionalMergeOutputArray){
    var dep, mergeOutputArray = optionalMergeOutputArray || [field];
    _.forEach(depNamesArray,function (depName) {
      dep = fieldsHash[depName];
      if(!dep){
        throw new Error('no field exists with key: ' + depName);
      }
      // We should be able to speed this up by actually merging the
      // dependencies into each field in the fieldsHash on the first run, then using the
      // cached fields in the future.
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
});
