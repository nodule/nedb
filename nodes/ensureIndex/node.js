output = function() {
  input.db.ensureIndex(input.options,
    function(err) {
    if(err) {
      output({error: err});
    } else {
      output({db: input.db});
    }
  });
};
