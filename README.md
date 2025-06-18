A CLI tool to batch-modify React components that match specific conditions.

## Getting Started

Create a target Component file.

```tsx
// component/wrap.tsx
export default function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="wrapper">{children}</div>;
}
```

Run the command.

```bash
cd your-project
pnpx jsx-inject --action wrap --input component/wrap.tsx --target src/**/page.tsx --exclude private/page.tsx --target-component Base --props "className='wrapper'"
```

Or json config.

```json
// jsx-inject.config.json
[
  {
    "action": "wrap",

    "input": "component/wrap.tsx",
    "target": "src/**/page.tsx",
    "exclude": "private/page.tsx",

    "target-component": "Base", // default: undefined (root component)
    "onlyDefaultReturnComponent": true, // default: false

    "overwrite": true, // default: false
    "props": "className='wrapper' data-testid='wrap-1'"
  },
]
```

And you can use the `jsx-inject` command as follows.

```bash
pnpx jsx-inject
```
