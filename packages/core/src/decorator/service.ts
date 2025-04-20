import { Injectable } from '@rabjs/ioc';
import 'reflect-metadata';
import { serviceDecorator } from '../symbols';

/**
 * Service decorator that combines @Injectable() and extends the base Service class
 * This allows for a cleaner syntax: @Service() instead of @Injectable() and extends Service
 */
export function Service() {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    // Apply the Injectable decorator
    Injectable()(constructor);

    // Add service metadata
    Reflect.defineMetadata(serviceDecorator, true, constructor);

    // Return the constructor
    return constructor;
  };
}
