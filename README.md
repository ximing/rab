# rab
React and redux based framework.

# API

initialize:
let app = rab({
    
})

app.use(plugins)

app.router()

app.start('#id')


model

{
    namespace:'users',
    state:{},
    reducers:{
        getUser:(state,action)=>{
            
        }
    },
    mutations:{
        getUser:async ({ id,arg }, { getState, dispatch })=>{
            return state;
        }
    }
}

components:

this.props.dispatch({type:'users.getUser',payload:{id,arg})