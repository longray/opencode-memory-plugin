;; Tree-sitter Query for Go
;; Extracts functions, structs, interfaces, imports, and call expressions

;; Function declarations
(
  (function_declaration
    name: (identifier) @function.name
    parameters: (parameter_list) @function.params
    body: (block) @function.body
  ) @function.def
)

;; Method declarations
(
  (method_declaration
    receiver: (parameter_list) @method.receiver
    name: (field_identifier) @method.name
    parameters: (parameter_list) @method.params
    body: (block) @method.body
  ) @method.def
)

;; Struct type declarations
(
  (type_declaration
    (type_spec
      name: (type_identifier) @struct.name
      type: (struct_type) @struct.type
    )
  ) @struct.def
)

;; Interface type declarations
(
  (type_declaration
    (type_spec
      name: (type_identifier) @interface.name
      type: (interface_type) @interface.type
    )
  ) @interface.def
)

;; Import declarations
(
  (import_declaration
    (import_spec
      path: (interpreted_string_literal) @import.path
    )
  ) @import.spec
)

;; Import declarations with alias
(
  (import_declaration
    (import_spec
      name: (package_identifier) @import.alias
      path: (interpreted_string_literal) @import.path
    )
  ) @import.aliased
)

;; Call expressions
(
  (call_expression
    function: (identifier) @call.name
  ) @call.direct
)

;; Method call expressions
(
  (call_expression
    function: (selector_expression
      operand: (_) @call.object
      field: (field_identifier) @call.method
    )
  ) @call.method
)

;; Package declaration
(
  (package_clause
    (package_identifier) @package.name
  ) @package.decl
)
