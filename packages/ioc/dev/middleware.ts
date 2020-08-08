import 'reflect-metadata';
import { interfaces, Container, injectable } from 'inversify';

// eslint-disable-next-line
interface Ninja {}

@injectable()
class Ninja implements Ninja {}

const container = new Container();
container.bind<Ninja>('Ninja').to(Ninja);

function middleware1(planAndResolve: any): any {
  return (args: interfaces.NextArgs) => {
    const nextContextInterceptor = args.contextInterceptor;
    args.contextInterceptor = (context: interfaces.Context) => {
      console.log(context);
      const res = nextContextInterceptor(context);
      console.log(res);
      return res;
    };
    const result = planAndResolve(args);
    console.log(result);
    return `result`;
  };
}

container.applyMiddleware(middleware1);

const ninja = container.get<Ninja>('Ninja');
console.log(ninja);
