;; Tree-sitter Query for Java
;; Extracts methods, classes, interfaces, imports, and call expressions

;; Method declarations
(
  (method_declaration
    name: (identifier) @method.name
    parameters: (formal_parameters) @method.params
    body: (block) @method.body
  ) @method.def
)

;; Constructor declarations
(
  (constructor_declaration
    name: (identifier) @constructor.name
    parameters: (formal_parameters) @constructor.params
    body: (constructor_body) @constructor.body
  ) @constructor.def
)

;; Class declarations
(
  (class_declaration
    name: (identifier) @class.name
    body: (class_body) @class.body
  ) @class.def
)

;; Interface declarations
(
  (interface_declaration
    name: (identifier) @interface.name
    body: (interface_body) @interface.body
  ) @interface.def
)

;; Enum declarations
(
  (enum_declaration
    name: (identifier) @enum.name
    body: (enum_body) @enum.body
  ) @enum.def
)

;; Import declarations
(
  (import_declaration
    (identifier) @import.name
  ) @import.single
)

;; Import declarations with wildcard
(
  (import_declaration
    (identifier) @import.package
    (asterisk) @import.wildcard
  ) @import.wild
)

;; Method invocations
(
  (method_invocation
    name: (identifier) @call.method
    arguments: (argument_list) @call.args
  ) @call.method
)

;; Method invocations with object
(
  (method_invocation
    object: (_) @call.object
    name: (identifier) @call.method
  ) @call.method_obj
)

;; Class object access (static method calls)
(
  (method_invocation
    object: (identifier) @call.class
    name: (identifier) @call.method
  ) @call.static
)

;; Package declarations
(
  (package_declaration
    (identifier) @package.name
  ) @package.decl
)

;; Field declarations
(
  (field_declaration
    type: (_) @field.type
    declarator: (variable_declarator
      name: (identifier) @field.name
    )
  ) @field.decl
)

;; Annotation declarations
(
  (annotation
    name: (identifier) @annotation.name
  ) @annotation.decl
)
