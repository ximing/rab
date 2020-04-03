import { Service, Injectable } from '@rabjs/core';
import { History, Location, LocationState, Path } from 'history';

@Injectable()
export class RouterService extends Service {
  location!: Location;

  history!: History;

  _updateLocation(newState: Location) {
    this.location = newState;
  }

  /*
   * History methods
   */
  push = (location: Path, state?: LocationState) => {
    this.history.push(location, state);
  };

  replace = (location: Path, state?: LocationState) => {
    this.history.replace(location, state);
  };

  go = (n: number) => {
    this.history.go(n);
  };

  goBack = () => {
    this.history.goBack();
  };

  goForward = () => {
    this.history.goForward();
  };
}
