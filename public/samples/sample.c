#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TABLE_SIZE 256

typedef struct Entry {
    char *key;
    int value;
    struct Entry *next;
} Entry;

typedef struct {
    Entry *buckets[TABLE_SIZE];
    int count;
} HashTable;

unsigned int hash(const char *key) {
    unsigned int h = 5381;
    int c;
    while ((c = *key++))
        h = ((h << 5) + h) + c;
    return h % TABLE_SIZE;
}

void ht_set(HashTable *ht, const char *key, int value) {
    unsigned int idx = hash(key);
    Entry *e = ht->buckets[idx];
    while (e) {
        if (strcmp(e->key, key) == 0) { e->value = value; return; }
        e = e->next;
    }
    Entry *ne = malloc(sizeof(Entry));
    ne->key = strdup(key);
    ne->value = value;
    ne->next = ht->buckets[idx];
    ht->buckets[idx] = ne;
    ht->count++;
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}