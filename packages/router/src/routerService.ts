import { Service } from '@rabjs/core';
import { History, Location, LocationState, Path } from 'history';

@Service()
export class RouterService {
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
