export interface Paradigm {
  id: string;
  label: string;
  icon: string;
  color: string;
  tagline: string;
  description: string;
  relationModel: string;
  hints: string[];
}

export const PARADIGMS: Record<string, Paradigm> = {
  owl: {
    id: "owl",
    label: "OWL / RDF / Turtle",
    icon: "ti-topology-star-3",
    color: "#a78bfa",
    tagline: "W3C semantic web standards",
    description:
      "Entities are owl:Class. Relations are owl:ObjectProperty — first-class named predicates between two classes. The relation itself has no identity; it is a directed edge with a label and optional cardinality annotation. Attributes are owl:DatatypeProperty attached to a domain class. Inheritance follows rdfs:subClassOf. SHACL is used for constraints.",
    relationModel:
      "A relation is a named property arc (owl:ObjectProperty) between two classes. It carries a label and cardinality but has no independent identity — it cannot have its own attributes unless you reify it as a class.",
    hints: [
      "Relations are edges, not nodes — they cannot have their own attributes",
      "Use reification (rdf:Statement or named graphs) to add metadata to a relation",
      "Classification via rdfs:subClassOf enables inference",
      "SHACL sh:NodeShape defines constraints per class",
      "Prefer URI-stable identifiers (xsd:anyURI or xsd:string primary keys)",
    ],
  },
  metagraph: {
    id: "metagraph",
    label: "Metagraph",
    icon: "ti-topology-star",
    color: "#4f8ef7",
    tagline: "Metagraph metamodel principles",
    description:
      "In the Metagraph metamodel, a Relation is a first-class object — an entity with its own identity (a UUID). It has two typed foreign-key attributes linking it to its source and target entities. FK attributes MUST be named after the referenced entity's primary key: use '{entityName}Id' convention (e.g., a Relation between Customer and Order gets FKs named 'customerId' and 'orderId'; between Product and Category: 'productId' and 'categoryId'). Never use generic names like 'sourceRef' or 'targetRef'. Additional attributes can be freely added to the relation object (validity period, weight, role, status etc.). Inheritance works through classification hierarchies where child classes inherit attribute implementations from parents.",
    relationModel:
      "A relation is an object with its own UUID and two mandatory FK attributes named after the referenced entities: '{sourceName}Id' pointing to the source entity's PK and '{targetName}Id' pointing to the target entity's PK. Example — Customer→Order relation: customerId + orderId; Product→Category relation: productId + categoryId. NEVER use 'sourceRef', 'targetRef', 'sourceId', or 'targetId'. Additional attributes are welcome.",
    hints: [
      "Relations are objects — add attributes (validFrom, validTo, weight, role) directly to them",
      "FK naming RULE: '{entityName}Id' — Customer → customerId, Category → categoryId, Product → productId",
      "NEVER use generic FK names: 'sourceRef', 'targetRef', 'sourceId', 'targetId' are always wrong",
      "Look at the existing entity PKs (marked with * in the model context) and name FKs to match",
      "Use a RelationType ValueSet to classify relation instances",
      "Attribute implementations are inherited down classification hierarchies",
      "A disabled attribute implementation higher up suppresses it at all lower levels",
      "Prefer Attribute metaclass entities for shared, reusable property structures",
    ],
  },
};
