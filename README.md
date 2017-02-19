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
        hello:(state,action)=>{
            
        }
    },
    mutations:{
        async getUser:({ payload: {id,arg} }, { getState, dispatch })=>{
        }
    }
    subscribe:(){}
}

components:

this.props.dispatch('users.getUser',id,arg)