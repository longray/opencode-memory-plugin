;; Tree-sitter Query for Python
;; Extracts functions, classes, imports, and call expressions

;; Function definitions
(
  (function_definition
    name: (identifier) @function.name
    parameters: (parameters) @function.params
    body: (block) @function.body
  ) @function.def
)

;; Class definitions
(
  (class_definition
    name: (identifier) @class.name
    body: (block) @class.body
  ) @class.def
)

;; Import statements
(
  (import_statement
    name: (dotted_name) @import.name
  ) @import.stmt
)

;; Import from statements
(
  (import_from_statement
    module_name: (dotted_name) @import.module
  ) @import.from
)

;; Call expressions
(
  (call
    function: (identifier) @call.name
  ) @call.direct
)

;; Method calls
(
  (call
    function: (attribute
      object: (_) @call.object
      attribute: (identifier) @call.method
    )
  ) @call.method
)

;; Decorated functions
(
  (decorated_definition
    (decorator
      (identifier) @decorator.name
    ) @decorator
    definition: (function_definition
      name: (identifier) @function.name
    ) @function.def
  ) @function.decorated
)

;; Lambda expressions
(
  (lambda
    parameters: (lambda_parameters) @lambda.params
    body: (_) @lambda.body
  ) @lambda.expr
)
