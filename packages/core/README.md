# `core`

> TODO: description

## Usage

```
const { Service, Reducer, Effect } = require('@rabjs/core');

class UserService extends Service{
    defaultState = {
        name: "hello"
    }

    @Inject() service1: Service1;

    @Reducer
    setName(state, name){
        return {...state, name}
    }
    
    @ImmerReducer
    setN(state, payload){
        state.name = payload;
        return state;
    }

    @Effect
    async init(params, state){
        const res = await api();
        this.actions.setName(payload);
        // this.service1.actions.
    }
}

const Home = ()=>{
    const [state, actions] = useService(UserService)
    reutrn (
        <div>
            {state.name}
            <button onClick={()=>{actions.setName("new name")}}>setName</button>
        </div>
    )
}

// TODO: DEMONSTRATE API
```
