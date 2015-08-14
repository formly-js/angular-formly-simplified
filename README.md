## Simple version of formly

### Requirements

* for now, requires lodash 3.10
* angular 1.3 (probably works with 1.2 as well as formly does)

// Usage:

### In factory/service/wherever
```js
//
//
//
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
//  $scope.fields = [
//    'dog.name',
//    'dog.color',
//    'dog.bark',
//    'dog.runAwayButton'
//  ];
//
//  ..or..
//
//  $scope.fields = [
//    {template:'<div>Foo</div>'},
//    'dog.name',
//    {template:'<div>Bar</div>'},
//    'dog.runAwayButton'
//  ];
//
//  ..or..
//
//  $scope.fields = {
//    fields:['dog.name','dog.color',{defaults:['text']}],
//    afterForm:['addButton','submitButton']
//    defaults:[
//      'validators.required'
//    ],
//    mixins:[
//      {wrapper:'<div>wrapped-><formly-transclude></formly-transclude><-wrapped</div>'}
//    ],
//  };
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
//  ..with automatic recursive submodels...
//  $scope.fields = [
//    'dog.pack',
//    {
//     data:{
//       subModels:{
//         customFields:[
//           {templateUrl:'views/layouts/block.custom-fields-edit.tpl.html'}
//         ]
//       }
//     }
//
//  }]
//  
//  ..with aliases that replace one field with multiple..
// 'dog.pack':{
//   data:{
//     aliasFor:[
//       'dog.aa',
//       'dog.bb',
//       'dog.cc',
//       'dog.dd',
//       'dog.ee',
//       'dog.ff'
//     ]
//   }
// },
//
//  model may be nested{foo:{bar:{baz:{}}}}
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
//
//
//  .. in HTML
//
//  <at-form fields="fields" model="model"></at-form>
//
//  
//  tbd:
//    - figure out how to get top level scope functions to trickle down into fields...
//      even though it breaks encapsulation, it would be VERY useful for
//      incremental migration to formly
//    - decide how to mix in functions like controller, onChange, and link
//    - consider named child fields in templates, similar to named views in ui-router
//      e.g., {template:'<tpl field="to.subs.a"></tpl>stuff<tpl field="to.subs.b"></tpl>'}
//
//  done(ish).. needs review:
//    - actually put some thought into models arrays support
//      (mostly done I think)
//      
//      
```
