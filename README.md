# rab
React and redux based framework.

# API

initialize:
let app = rab({
    //支持旧项目已有的reducers
    extraReducers:{}
})

//use redux middleware
app.use(middleware)


//use router
app.router(({ history }) => {
  return (
    <Router history={history}>
      <Route path="/" component={App} />
    </Router>
  );
});

app.addModel(someMode);

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
    },
    subscriptions:{
        path({dispatch,history,getState}){
        }
    }
}

components:

this.props.dispatch({type:'users.getUser',payload:{id,arg})