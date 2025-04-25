
# 📊 Code Quality & Health Metrics Cheat Sheet

A comprehensive guide to key metrics used to assess software maintainability, cleanliness, and design quality.

---

## 🧠 Structural & Complexity Metrics

### ✅ Cyclomatic Complexity
- **Definition**: Number of linearly independent paths through a function.
- **Why**: High complexity means higher risk of bugs.
- **Target**: < 10 per function.

### ✅ Function Length
- **Definition**: Number of lines in a function/method.
- **Why**: Long functions are harder to read/test.
- **Target**: < 40 lines (preferably < 20).

### ✅ Class Length
- **Definition**: Number of lines in a class.
- **Why**: Large classes often violate SRP (Single Responsibility Principle).
- **Target**: < 500 lines; refactor if bigger.

### ✅ Nesting Depth
- **Definition**: Maximum depth of nested code blocks (e.g., ifs/loops).
- **Why**: Deep nesting reduces readability.
- **Target**: Max 3–4 levels.

### ✅ Indentation Width
- **Definition**: Measure of code block indentation.
- **Why**: Wide indentation indicates complexity and poor design.

---

## 🔁 Dependency & Design Metrics

### ✅ Circular Dependencies
- **Definition**: Modules/classes that depend on each other directly or indirectly.
- **Why**: Makes systems fragile and hard to test.
- **Fix**: Refactor using dependency inversion or shared abstraction.

### ✅ Coupling
- **Definition**: How strongly modules depend on each other.
- **Why**: High coupling reduces flexibility and testability.
- **Goal**: Favor loose coupling via interfaces.

### ✅ Cohesion
- **Definition**: Degree to which methods/fields of a class relate to a single purpose.
- **Why**: High cohesion improves modularity.
- **Check**: Look for unrelated methods living in one class.

### ✅ Instability (Abstractness/Instability Balance)
- **Definition**: Metrics from Robert Martin’s package design principles (A/I graph).
- **Why**: Packages should be either stable or abstract — avoid stable+concrete.

---

## 🚨 Maintainability Metrics

### ✅ Code Duplication
- **Definition**: Repeated logic across the codebase.
- **Tool**: SonarQube, PMD
- **Fix**: Extract methods, refactor shared logic.

### ✅ Code Smells
- **Definition**: Indicators of potential design issues (e.g. God classes, long methods).
- **Tool**: SonarQube, ReSharper, ESLint

### ✅ Magic Numbers / Strings
- **Fix**: Use named constants or enums.

---

## 🧪 Testing Metrics

### ✅ Code Coverage
- **Definition**: % of code exercised by tests.
- **Target**: 80%+ — but quality > quantity.

### ✅ Mutation Testing Score
- **Definition**: % of introduced bugs caught by tests.
- **Tool**: Stryker, PIT
- **Why**: Reveals test effectiveness.

---

## ⚙️ Tooling Suggestions

| Metric | Suggested Tools |
|--------|------------------|
| Cyclomatic Complexity | `radon` (Python), ESLint, CodeClimate |
| Function/Class Length | SonarQube, ESLint, PMD |
| Circular Dependencies | `madge`, `dependency-cruiser` (JS), `import-linter` (Python) |
| Coupling/Cohesion | SonarQube, Structure101 |
| Nesting/Indentation | linters + IDEs |
| Code Smells | ReSharper, SonarQube, PMD |
| Test Coverage | Jest, Istanbul, Coverage.py |
| Mutation Testing | Stryker, PIT |

---

## 🧭 TL;DR — What to Watch

- 🚩 High cyclomatic complexity? Refactor to smaller methods.
- 🚩 Long functions/classes? Split for readability and SRP.
- 🚩 Circular dependencies? Break the loop.
- 🚩 Low cohesion or high coupling? Revisit your architecture.
- 🚩 Poor coverage or mutation score? Write better tests.
- 🚩 Lots of smells or duplication? Clean as you go.

---

> “Good code is measured not by what it does, but by how clearly and safely it can grow.” – Clean Architecture mindset

---
