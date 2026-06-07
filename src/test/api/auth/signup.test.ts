{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "types": ["vitest/globals"]
  },
  "include": ["src", "src/test"],
  "exclude": ["node_modules"]
}
</ARG>
```

```tool
TOOL_NAME: run_terminal_command
BEGIN_ARG: command
npm install