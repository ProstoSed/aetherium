import { useSyncExternalStore } from 'react';

/**
 * Минимальное хранилище состояния между движком и интерфейсом.
 * Сюда кладётся только то, что меняется от действий человека или редко
 * (выбранное тело, режим масштаба, активное событие). Покадровые величины —
 * дата, прогресс события, расстояния — идут мимо React, прямой записью в DOM:
 * иначе интерфейс перерисовывается десятки раз в секунду и съедает кадр.
 */
export type Store<T> = {
  get: () => T;
  set: (patch: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      const changed = Object.keys(next).some(key => !Object.is(state[key as keyof T], next[key as keyof T]));
      if (!changed) return;
      state = { ...state, ...next };
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
