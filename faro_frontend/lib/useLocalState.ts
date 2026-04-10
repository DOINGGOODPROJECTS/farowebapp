"use client";

import { useEffect, useState } from "react";

type Getter<T> = () => T;
type Setter<T> = (value: T) => void;

export const useLocalState = <T,>(getter: Getter<T>, setter: Setter<T>) => {
  const [value, setValue] = useState<T>(getter);

  useEffect(() => {
    setValue(getter());
  }, [getter]);

  useEffect(() => {
    setter(value);
  }, [value, setter]);

  return [value, setValue] as const;
};
