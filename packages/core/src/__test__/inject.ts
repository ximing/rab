import 'reflect-metadata';
import { Container } from 'inversify';
import { getActionNames, reducer, model } from '../decorators';
import { Model, IModel } from '../model';

@model('test')
class MClass extends Model<{
    name:string
}>{
    getName(){
        return '1234'
    }
}

const myContainer = new Container();
myContainer.bind<MClass>(MClass).to(MClass);
const m = myContainer.resolve<MClass>(MClass);
console.log(m.getName())