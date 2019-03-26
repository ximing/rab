export default function ownKeys(object) {
    if (typeof Reflect !== 'undefined' && typeof Reflect.ownKeys === 'function') {
        return Reflect.ownKeys(object);
    }

    let keys :Array<any> = Object.getOwnPropertyNames(object);

    if (typeof Object.getOwnPropertySymbols === 'function') {
        keys = keys.concat(Object.getOwnPropertySymbols(object));
    }

    return keys;
}
