# Sheer Health Project:

## Project Description:

This project is intended to take between 2-4 hours to complete. It is open-ended
enough that you could potentially spend dozens of hours, so make sure you
timebox yourself so you don’t go overboard. We’ll review it under the lens that
it was time limited and are happy to review partial solutions. Criteria The NHS
has a list of medicines. Your mission, should you choose to accept it, is to
extract this information into a JSON bundle. The JSON bundle should consist of a
map of objects, the key being the medication name, with the object contents
being details about that medication.

For your submission please include both your code and the JSON bundle. You are
welcome to use any language or framework that you’d like for this project,
though we recommend javascript/typescript with Playwright or Puppeteer.

To install dependencies:

```bash
bun install
bunx playwright install chromium
```

To run:

```bash
bun start
```

### Format code

```bash
bun run fmt
```

### Build native executable

```bash
bun run build:exe
```

### Output

Please check output.json in current working directory.

## Features

- Parallel Tabs.
- Native Executables.
- Clean and Readable code.
- Proper separation of concerns like configs, loggers.
- Proper validation using zod.
- Proper logging

## Todo:

- This project actually don't need playwright, simple fetch/got should work.
- Add tools like eslint.
- Make more robout and resilient. For example, if playwright crashes in middle, we should do something.
- Stream data to output as soon as it is ready instead of waiting for everything.
- If there are some errors, may be we should retry?
- Test
