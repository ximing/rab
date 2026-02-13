import { observable, observe } from './lib/main.js';
const arr = observable([
  {
    id: 1,
    name: '经典汉堡',
  },
]);
debugger;
const p = arr.filter(item => item.id != 1);
debugger;

// const localScheduledReactions = [];
// const obj = observable({
//   products: [
//     {
//       id: 1,
//       name: '经典汉堡',
//     },
//     {
//       id: 2,
//       name: '拿铁咖啡',
//     },
//     {
//       id: 3,
//       name: '芝士披萨',
//     },
//   ],
//   get filteredProducts() {
//     debugger;
//     let p = this.products.filter(item => item.id != 1);
//     p.sort((a, b) => {
//       return b.name.localeCompare(a.name);
//     });
//     return p;
//   },
// });
// const localScheduler = reaction => {
//   localScheduledReactions.push(reaction);
// };
// const reaction = observe(
//   () => {
//     return obj.filteredProducts;
//   },
//   { lazy: true, scheduler: localScheduler }
// );
// reaction();
// debugger;
