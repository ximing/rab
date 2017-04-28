model

{
    namespace:'',
    state:{},
    reducers:{
        hello(state,action){}
    },
    actions:{
        async hello(args){
            
        }
    }
}

## call actions

√ dispatch(model.actions.hello(args));

The code is further encapsulated

√ put({type:'namespace.hello',args});

The code is further encapsulated
 
√ call('namespace.hello',args);

## call reducers

√ dispatch({type:'namespace.hello',payload:{}});




