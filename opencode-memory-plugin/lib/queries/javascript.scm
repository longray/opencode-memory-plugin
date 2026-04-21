;; Tree-sitter Query for JavaScript/TypeScript
;; Extracts functions, classes, imports, and call expressions

;; Function declarations
(
  (function_declaration
    name: (identifier) @function.name
    parameters: (formal_parameters) @function.params
    body: (statement_block) @function.body
  ) @function.def
)

;; Arrow functions (variable declaration)
(
  (variable_declarator
    name: (identifier) @function.name
    value: (arrow_function
      parameters: (_) @function.params
      body: (_) @function.body
    )
  ) @function.arrow
)

;; Method definitions in classes
(
  (method_definition
    name: (property_identifier) @method.name
    parameters: (formal_parameters) @method.params
    body: (statement_block) @method.body
  ) @method.def
)

;; Class declarations
(
  (class_declaration
    name: (identifier) @class.name
    body: (class_body) @class.body
  ) @class.def
)

;; Import statements
(
  (import_statement
    source: (string) @import.source
  ) @import.stmt
)

;; Import from statements
(
  (import_statement
    source: (string) @import.source
    clause: (import_clause
      (named_imports
        (import_specifier
          name: (identifier) @import.name
        )
      )
    )
  ) @import.named
)

;; Call expressions
(
  (call_expression
    function: (identifier) @call.name
  ) @call.direct
)

;; Method calls
(
  (call_expression
    function: (member_expression
      object: (_) @call.object
      property: (property_identifier) @call.method
    )
  ) @call.method
)

;; Export statements
(
  (export_statement
    declaration: (function_declaration
      name: (identifier) @export.name
    )
  ) @export.function
)

(
  (export_statement
    declaration: (class_declaration
      name: (identifier) @export.name
    )
  ) @export.class
)

;; Async functions
(
  (function_declaration
    (async) @function.async
    name: (identifier) @function.name
  ) @function.async_def
)
