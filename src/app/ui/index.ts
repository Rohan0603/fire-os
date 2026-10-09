/**
 * Shared UI kit barrel.
 *
 * Import from `@/app/ui` style paths (`../ui`) rather than deep paths, so a
 * component can be reorganised without touching every consumer.
 *
 * Toast is deliberately absent: it is still imperative (`src/modules/ui/Toast.ts`)
 * because 40 call sites go through the `showToast` feature port, and porting it
 * to a Radix provider is its own change with its own test pass. The kit Toast
 * lands with that port, not before.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';
export { Input, FieldLabel } from './Input';
export type { InputProps } from './Input';
export { Card, CardHeader, CardTitle, CardBody, CardFooter } from './Card';
export type { CardProps } from './Card';
export {
  Table,
  TableCaption,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableNumericCell,
} from './Table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps } from './Tabs';
export { Select, SelectItem, SelectGroup, SelectLabel } from './Select';
export type { SelectProps } from './Select';
export { Dialog, DialogTrigger, DialogClose } from './Dialog';
export type { DialogProps } from './Dialog';
export { cn } from './cn';
