output = function() {
  input.db.removeIndex(input.fieldName,
    function(err) {
    if(err) {
      output({error: err});
    } else {
      output({db: input.db});
    }
  });
};
