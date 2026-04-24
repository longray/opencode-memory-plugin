;; Tree-sitter Query for Rust
;; Extracts functions, structs, enums, traits, imports, and call expressions

;; Function items
(
  (function_item
    name: (identifier) @function.name
    parameters: (parameters) @function.params
    body: (block) @function.body
  ) @function.def
)

;; Async function items
(
  (function_item
    (function_modifiers "async") @function.async
    name: (identifier) @function.name
  ) @function.async_def
)

;; Struct items
(
  (struct_item
    name: (type_identifier) @struct.name
    body: (field_declaration_list) @struct.body
  ) @struct.def
)

;; Enum items
(
  (enum_item
    name: (type_identifier) @enum.name
    body: (enum_variant_list) @enum.body
  ) @enum.def
)

;; Trait items
(
  (trait_item
    name: (type_identifier) @trait.name
    body: (declaration_list) @trait.body
  ) @trait.def
)

;; Impl items
(
  (impl_item
    type: (type_identifier) @impl.type
    body: (declaration_list) @impl.body
  ) @impl.def
)

;; Use declarations (imports)
(
  (use_declaration
    argument: (use_wildcard) @import.wildcard
  ) @import.wild
)

(
  (use_declaration
    argument: (scoped_identifier) @import.scoped
  ) @import.scoped
)

(
  (use_declaration
    argument: (identifier) @import.name
  ) @import.simple
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
    function: (field_expression
      value: (_) @call.object
      field: (field_identifier) @call.method
    )
  ) @call.method
)

;; Macro invocations
(
  (macro_invocation
    macro: (identifier) @macro.name
    (token_tree) @macro.tokens
  ) @macro.invocation
)
